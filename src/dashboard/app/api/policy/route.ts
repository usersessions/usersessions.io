/**
 * GET  /api/policy  list policy rules
 * POST /api/policy  create one rule
 * PUT  /api/policy  replace all rules
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ALWAYS_REQUIRES_APPROVAL } from '@/services/policy'
import { neverAuto, normalizeAction, toolkitSupportsAction } from '@/services/action-catalog'
import { AUTONOMY_LEVELS } from '@/types/constants'

export const dynamic = 'force-dynamic'

const CATEGORIES = new Set(['bug', 'friction', 'billing', 'security'])
const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3'])
const MAX_RULES = 50

interface ValidRule {
  name: string
  condition: Record<string, unknown>
  action_template: { toolkit: string; action: string; params_template: Record<string, unknown> }
  autonomy_level: 'auto' | 'approve_required'
  precision_thresholds: Record<string, number> | null
  active: boolean
}

/** Returns a normalised rule or an error message. */
function validateRule(raw: any, index: number): { rule?: ValidRule; error?: string } {
  const label = `rule ${index + 1}`
  if (!raw || typeof raw !== 'object') return { error: `${label}: must be an object` }

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 120) : `Rule ${index + 1}`

  const c = raw.condition && typeof raw.condition === 'object' ? raw.condition : {}
  const condition: Record<string, unknown> = {}
  if (c.category != null) {
    if (!CATEGORIES.has(c.category)) return { error: `${label}: invalid category` }
    condition.category = c.category
  }
  if (c.severity != null) {
    if (!SEVERITIES.has(c.severity)) return { error: `${label}: invalid severity` }
    condition.severity = c.severity
  }
  for (const k of ['arr_gte', 'arr_lt'] as const) {
    if (c[k] != null) {
      const n = Number(c[k])
      if (!Number.isFinite(n) || n < 0) return { error: `${label}: ${k} must be a non-negative number` }
      condition[k] = n
    }
  }

  const t = raw.action_template
  if (!t || typeof t !== 'object') return { error: `${label}: action_template is required` }
  const toolkit = typeof t.toolkit === 'string' ? t.toolkit.toUpperCase() : ''
  const action = normalizeAction(t.action)
  if (!toolkit || !action) return { error: `${label}: action_template.toolkit and a known action are required` }
  if (!toolkitSupportsAction(toolkit, action)) return { error: `${label}: ${toolkit} cannot perform ${action}` }

  const autonomy = raw.autonomy_level === AUTONOMY_LEVELS.AUTO ? AUTONOMY_LEVELS.AUTO : AUTONOMY_LEVELS.APPROVE_REQUIRED
  if (autonomy === AUTONOMY_LEVELS.AUTO && (ALWAYS_REQUIRES_APPROVAL.has(action) || neverAuto(action) || toolkit === 'UIPATCH')) {
    return { error: `${label}: ${action} can never be set to auto` }
  }

  let precision: Record<string, number> | null = null
  if (raw.precision_thresholds && typeof raw.precision_thresholds === 'object') {
    precision = {}
    for (const k of ['min_confidence', 'min_rage_clicks', 'min_drop_pct'] as const) {
      const v = raw.precision_thresholds[k]
      if (v != null) {
        const n = Number(v)
        if (!Number.isFinite(n) || n < 0) return { error: `${label}: precision_thresholds.${k} must be a non-negative number` }
        precision[k] = n
      }
    }
  }

  return {
    rule: {
      name,
      condition,
      action_template: { toolkit, action, params_template: t.params_template && typeof t.params_template === 'object' ? t.params_template : {} },
      autonomy_level: autonomy,
      precision_thresholds: precision,
      active: raw.active !== false,
    },
  }
}

async function getClientId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from('us_clients').select('id').eq('profile_id', userId).maybeSingle()
  return data?.id ?? null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await getClientId(supabase, user.id)
  if (!clientId) return NextResponse.json({ rules: [] })

  const { data: rules, error } = await supabase
    .from('us_policy_rules')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: rules ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await getClientId(supabase, user.id)
  if (!clientId) return NextResponse.json({ error: 'No client configured' }, { status: 422 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { rule, error: vErr } = validateRule(body, 0)
  if (!rule) return NextResponse.json({ error: vErr }, { status: 400 })

  const { data, error } = await supabase
    .from('us_policy_rules')
    .insert({ client_id: clientId, ...rule })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await getClientId(supabase, user.id)
  if (!clientId) return NextResponse.json({ error: 'No client configured' }, { status: 422 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!Array.isArray(body?.rules)) return NextResponse.json({ error: 'rules array required' }, { status: 400 })
  if (body.rules.length > MAX_RULES) return NextResponse.json({ error: `At most ${MAX_RULES} rules` }, { status: 400 })

  // Validate everything BEFORE touching the existing rules
  const validated: ValidRule[] = []
  for (let i = 0; i < body.rules.length; i++) {
    const { rule, error } = validateRule(body.rules[i], i)
    if (!rule) return NextResponse.json({ error }, { status: 400 })
    validated.push(rule)
  }

  if (validated.length === 0) {
    const { error } = await supabase.from('us_policy_rules').delete().eq('client_id', clientId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, rules: [] })
  }

  // Insert the new set first, then remove the old rows, so a failed insert never
  // leaves the client with no rules.
  const { data: inserted, error: insErr } = await supabase
    .from('us_policy_rules')
    .insert(validated.map((r) => ({ client_id: clientId, ...r })))
    .select()
  if (insErr || !inserted) return NextResponse.json({ error: insErr?.message ?? 'Insert failed' }, { status: 500 })

  const keep = inserted.map((r: any) => r.id)
  const { error: delErr } = await supabase
    .from('us_policy_rules')
    .delete()
    .eq('client_id', clientId)
    .not('id', 'in', `(${keep.map((id: string) => `"${id}"`).join(',')})`)
  if (delErr) console.error('[api/policy] failed to prune old rules:', delErr.message)

  return NextResponse.json({ success: true, rules: inserted })
}
