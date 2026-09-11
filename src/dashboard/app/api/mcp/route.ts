import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { approveAction, dismissAction } from '@/services/approval'
import { requireLicenseOrSubscription } from '@/lib/billing/license'
import { ACTION_STATUSES } from '@/types/constants'
import { normalizeAction, toolkitSupportsAction } from '@/services/action-catalog'

export const dynamic = 'force-dynamic'

/**
 * Stateless MCP over HTTP (JSON-RPC). Authenticated with a bearer API key that
 * was generated in Settings; we store sha256(key) so the raw key is hashed here
 * before lookup. Every tool is scoped to the token's client_id.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WRITE_TOOLS = new Set(['approve_action', 'approve_finding', 'dismiss_action', 'create_policy_rule'])

function rpcResult(id: unknown, text: string, isError = false) {
  return NextResponse.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError } })
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const rawToken = authHeader.slice(7).trim()
    if (!rawToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    const supabase = createServiceClient()

    const { data: mcpToken } = await supabase
      .from('us_mcp_tokens')
      .select('id, client_id, scopes')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle()

    if (!mcpToken) {
      return NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 })
    }

    await supabase.from('us_mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', mcpToken.id)

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 })
    }
    const { method, params, id } = body ?? {}

    const clientId: string = mcpToken.client_id
    const scopes: string[] = mcpToken.scopes || []

    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'UserSessions.io MCP', version: '1.1.0' },
        },
      })
    }

    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            { name: 'get_findings', description: 'Query findings by severity or status.', inputSchema: { type: 'object', properties: { severity: { type: 'string' }, status: { type: 'string' } } } },
            { name: 'get_actions', description: 'Query the action audit log.', inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
            { name: 'get_accounts', description: 'Get accounts with ARR at risk.', inputSchema: { type: 'object', properties: {} } },
            { name: 'get_heatmap_summary', description: 'Get aggregated heatmap grid data for a page and viewport.', inputSchema: { type: 'object', properties: { urlPattern: { type: 'string' }, viewport: { type: 'string' } }, required: ['urlPattern', 'viewport'] } },
            { name: 'approve_action', description: 'Approve and execute a pending action (requires write:actions scope).', inputSchema: { type: 'object', properties: { actionId: { type: 'string' } }, required: ['actionId'] } },
            { name: 'dismiss_action', description: 'Dismiss a pending action (requires write:actions scope).', inputSchema: { type: 'object', properties: { actionId: { type: 'string' }, reason: { type: 'string' } }, required: ['actionId'] } },
            { name: 'create_policy_rule', description: 'Create a policy rule (requires write:actions scope). Rules default to approve_required.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, category: { type: 'string' }, severity: { type: 'string' }, toolkit: { type: 'string' }, action: { type: 'string' }, autonomy_level: { type: 'string', enum: ['auto', 'approve_required'] } }, required: ['name', 'toolkit', 'action'] } },
          ],
        },
      })
    }

    if (method === 'tools/call') {
      const name: string = params?.name ?? ''
      const args: Record<string, any> = params?.arguments ?? {}

      if (WRITE_TOOLS.has(name) && !scopes.includes('write:actions')) {
        return rpcResult(id, 'Error: Forbidden. Token lacks write:actions scope.', true)
      }

      switch (name) {
        case 'get_findings': {
          let q = supabase.from('us_findings').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50)
          if (typeof args.severity === 'string') q = q.eq('severity', args.severity)
          if (typeof args.status === 'string') q = q.eq('status', args.status)
          const { data } = await q
          return rpcResult(id, JSON.stringify(data ?? [], null, 2))
        }
        case 'get_actions': {
          let q = supabase.from('us_actions').select('*, us_findings(summary, severity)').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50)
          if (typeof args.status === 'string') q = q.eq('status', args.status)
          const { data } = await q
          return rpcResult(id, JSON.stringify(data ?? [], null, 2))
        }
        case 'get_accounts': {
          const { data } = await supabase.from('us_accounts').select('*').eq('client_id', clientId).limit(50)
          return rpcResult(id, JSON.stringify(data ?? [], null, 2))
        }
        case 'get_heatmap_summary': {
          if (typeof args.urlPattern !== 'string' || typeof args.viewport !== 'string') return rpcResult(id, 'Error: urlPattern and viewport are required.', true)
          const { data } = await supabase.from('us_heatmap_aggregates')
            .select('*')
            .eq('client_id', clientId)
            .eq('page_url_pattern', args.urlPattern)
            .eq('viewport_bucket', args.viewport)
            .order('date_trunc_hour', { ascending: false })
            .limit(10)
          return rpcResult(id, JSON.stringify(data ?? [], null, 2))
        }
        case 'approve_action':
        case 'approve_finding': {
          if (typeof args.actionId !== 'string' || !UUID_RE.test(args.actionId)) return rpcResult(id, 'Error: actionId must be a UUID.', true)
          const { data: action } = await supabase
            .from('us_actions')
            .select('id, status, client_id')
            .eq('id', args.actionId)
            .eq('client_id', clientId)
            .maybeSingle()
          if (!action) return rpcResult(id, 'Error: Action not found in this workspace.', true)
          if (action.status !== ACTION_STATUSES.APPROVE_REQUIRED) return rpcResult(id, `Error: Action is not awaiting approval (status: ${action.status}).`, true)
          if (!(await requireLicenseOrSubscription(clientId))) return rpcResult(id, 'Error: Action execution requires an active subscription or enterprise license.', true)

          const result = await approveAction({ actionId: action.id, approvedByEmail: `mcp:${mcpToken.id}` })
          return result.success
            ? rpcResult(id, `Action ${action.id} approved and executed.`)
            : rpcResult(id, `Action ${action.id} approved but execution failed: ${result.error}`, true)
        }
        case 'dismiss_action': {
          if (typeof args.actionId !== 'string' || !UUID_RE.test(args.actionId)) return rpcResult(id, 'Error: actionId must be a UUID.', true)
          const { data: action } = await supabase
            .from('us_actions')
            .select('id, status')
            .eq('id', args.actionId)
            .eq('client_id', clientId)
            .maybeSingle()
          if (!action) return rpcResult(id, 'Error: Action not found in this workspace.', true)
          await dismissAction({ actionId: action.id, dismissedByEmail: `mcp:${mcpToken.id}`, reason: typeof args.reason === 'string' ? args.reason.slice(0, 500) : 'Dismissed via MCP' })
          return rpcResult(id, `Action ${action.id} dismissed.`)
        }
        case 'create_policy_rule': {
          const ruleName = typeof args.name === 'string' ? args.name.trim().slice(0, 120) : ''
          const toolkit = typeof args.toolkit === 'string' ? args.toolkit.toUpperCase() : ''
          const canonical = normalizeAction(args.action)
          if (!ruleName || !toolkit || !canonical) return rpcResult(id, 'Error: name, toolkit and a known action are required.', true)
          if (!toolkitSupportsAction(toolkit, canonical)) return rpcResult(id, `Error: ${toolkit} cannot perform ${canonical}.`, true)

          const condition: Record<string, string> = {}
          if (['bug', 'friction', 'billing', 'security'].includes(args.category)) condition.category = args.category
          if (['P0', 'P1', 'P2', 'P3'].includes(args.severity)) condition.severity = args.severity

          const { error } = await supabase.from('us_policy_rules').insert({
            client_id: clientId,
            name: ruleName,
            condition,
            action_template: { toolkit, action: canonical, params_template: {} },
            autonomy_level: args.autonomy_level === 'auto' ? 'auto' : 'approve_required',
            active: true,
          })
          if (error) return rpcResult(id, `Error: ${error.message}`, true)
          return rpcResult(id, `Policy rule "${ruleName}" created.`)
        }
        default:
          return rpcResult(id, `Unknown tool: ${name}`, true)
      }
    }

    return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not supported' } }, { status: 400 })
  } catch (err: any) {
    console.error('[MCP] Server error:', err?.message ?? err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
