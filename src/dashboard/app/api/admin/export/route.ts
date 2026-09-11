import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin'
import { requireAdminApi } from '@/lib/admin-api'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


const LIMIT = 5000

// Datasets are limited to tables that exist in this schema. Never include credential
// columns (session_source_api_key, token_hash) in an export.
const DATASETS: Record<string, { table: string; columns: string; order: string }> = {
  users: { table: 'profiles', columns: 'id, email, full_name, role, plan, subscription_status, created_at', order: 'created_at' },
  clients: { table: 'us_clients', columns: 'id, profile_id, name, plan_tier, connected_session_source, connected_composio_apps, client_domain, activation_step, created_at', order: 'created_at' },
  findings: { table: 'us_findings', columns: 'id, client_id, session_id, category, severity, confidence, summary, account_value, status, created_at', order: 'created_at' },
  actions: { table: 'us_actions', columns: 'id, client_id, finding_id, composio_toolkit, composio_action, autonomy_level, status, result, approved_by, executed_at, created_at', order: 'created_at' },
  sessions: { table: 'us_sessions', columns: 'id, client_id, source, error_count, rage_click_count, duration_seconds, started_at, ingested_at', order: 'ingested_at' },
  subscriptions: { table: 'us_subscriptions', columns: 'id, client_id, plan_code, status, current_period_start, current_period_end, created_at', order: 'created_at' },
  cron_logs: { table: 'cron_logs', columns: '*', order: 'created_at' },
  audit: { table: 'admin_audit_log', columns: '*', order: 'created_at' },
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

// Dataset export, CSV or JSON, capped at 5000 rows. Larger async exports with
// email delivery can build on this once needed.
export async function GET(request: Request) {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const dataset = params.get('dataset') ?? ''
  const format = params.get('format') === 'json' ? 'json' : 'csv'
  const def = DATASETS[dataset]
  if (!def) return NextResponse.json({ error: 'UNKNOWN_DATASET' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db.from(def.table).select(def.columns).order(def.order, { ascending: false }).limit(LIMIT)
  if (error) return NextResponse.json({ error: 'QUERY_FAILED' }, { status: 500 })

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  await audit(user.id, 'data_export', null, { dataset, format, rows: rows.length })

  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'json') {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="${dataset}-${stamp}.json"`,
      },
    })
  }
  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${dataset}-${stamp}.csv"`,
    },
  })
}
