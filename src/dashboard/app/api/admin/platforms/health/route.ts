import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'

const STALE_AFTER_MS = 6 * 60 * 60 * 1000 // 6h without a session = stale

type Row = {
  platform_id: string
  status: 'healthy' | 'stale' | 'no_data'
  last_check_at: string | null
  avg_response_ms: number | null
  error_rate: number
  adapter_version: string
  connected_clients: number
  sessions_24h: number
}

/**
 * Connector health per session source. There is no platform_health table in
 * this schema; health is derived from what actually arrived in us_sessions
 * over the last 24h for each connected source.
 */
export async function GET() {
  const user = await requireAdminApi()
  if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const db = createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: clients }, { data: sessions }] = await Promise.all([
    db.from('us_clients').select('connected_session_source').not('connected_session_source', 'is', null),
    db
      .from('us_sessions')
      .select('source, ingested_at, error_count')
      .gte('ingested_at', since)
      .order('ingested_at', { ascending: false })
      .limit(5000),
  ])

  const bySource = new Map<string, Row>()
  const ensure = (source: string): Row => {
    let row = bySource.get(source)
    if (!row) {
      row = {
        platform_id: source,
        status: 'no_data',
        last_check_at: null,
        avg_response_ms: null,
        error_rate: 0,
        adapter_version: 'n/a',
        connected_clients: 0,
        sessions_24h: 0,
      }
      bySource.set(source, row)
    }
    return row
  }

  for (const c of clients ?? []) {
    if (c.connected_session_source) ensure(c.connected_session_source).connected_clients += 1
  }

  const errorSessions = new Map<string, number>()
  for (const s of sessions ?? []) {
    const row = ensure(s.source)
    row.sessions_24h += 1
    if ((s.error_count ?? 0) > 0) errorSessions.set(s.source, (errorSessions.get(s.source) ?? 0) + 1)
    if (!row.last_check_at || s.ingested_at > row.last_check_at) row.last_check_at = s.ingested_at
  }

  const now = Date.now()
  for (const row of bySource.values()) {
    row.error_rate = row.sessions_24h > 0 ? (errorSessions.get(row.platform_id) ?? 0) / row.sessions_24h : 0
    if (!row.last_check_at) row.status = 'no_data'
    else row.status = now - new Date(row.last_check_at).getTime() > STALE_AFTER_MS ? 'stale' : 'healthy'
  }

  const health = [...bySource.values()].sort((a, b) => a.platform_id.localeCompare(b.platform_id))
  return NextResponse.json({ health, generatedAt: new Date().toISOString() })
}
