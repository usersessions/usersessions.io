import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { uploadReplayData } from '@/lib/r2'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 5 * 1024 * 1024
const MAX_EVENTS = 5000
const ALLOWED_SOURCES = new Set(['first_party', 'datadog_rum', 'posthog', 'fullstory', 'logrocket', 'hotjar'])

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Headers': 'Content-Type' } })
}

/**
 * POST /api/ingest/replay
 *
 * Receives rrweb events from capture.js for sessions that qualified client-side
 * (rage clicks or JS errors) and stores them in R2 keyed by session id.
 *
 * Body:
 *   session_id        UUID (== us_sessions.id)
 *   client_key        capture_public_key (public)
 *   events            rrweb event[]
 *   rage_click_count  cumulative for the session
 *   js_error_count    cumulative for the session
 *   scroll_depth_pct  0..100
 */
export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413)

  let body: {
    session_id?: unknown
    client_key?: unknown
    events?: unknown
    source?: unknown
    source_session_id?: unknown
    rage_click_count?: unknown
    js_error_count?: unknown
    scroll_depth_pct?: unknown
  }
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413)
    body = JSON.parse(text)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const session_id = body.session_id
  const client_key = body.client_key
  const events = body.events

  if (typeof session_id !== 'string' || typeof client_key !== 'string' || !Array.isArray(events)) {
    return json({ error: 'Missing required fields: session_id, client_key, events' }, 400)
  }
  if (!UUID_RE.test(session_id)) return json({ error: 'session_id must be a valid UUID' }, 400)
  if (events.length > MAX_EVENTS) return json({ error: `Too many events (max ${MAX_EVENTS})` }, 413)

  if (!rateLimit(`replay:${client_key}`, 300, 60_000)) return json({ error: 'Too many requests' }, 429)

  const source = typeof body.source === 'string' && ALLOWED_SOURCES.has(body.source) ? body.source : 'first_party'
  const rageClickCount = Math.max(0, Math.floor(Number(body.rage_click_count) || 0))
  const errorCount = Math.max(0, Math.floor(Number(body.js_error_count) || 0))
  const scrollDepth = typeof body.scroll_depth_pct === 'number'
    ? Math.max(0, Math.min(100, Math.round(body.scroll_depth_pct)))
    : null

  // Service-role client: this endpoint is unauthenticated (capture script has no user session).
  const supabase = createServiceClient()

  const { data: client, error: clientErr } = await supabase
    .from('us_clients')
    .select('id')
    .eq('capture_public_key', client_key)
    .maybeSingle()

  if (clientErr || !client) return json({ error: 'Invalid client key' }, 401)

  const { data: existing } = await supabase
    .from('us_sessions')
    .select('client_id, rage_click_count, error_count')
    .eq('id', session_id)
    .maybeSingle()
  if (existing && existing.client_id !== client.id) {
    return json({ error: 'Session belongs to another client' }, 403)
  }

  // Never let a late replay flush lower counters the heatmap path already recorded.
  const finalRage = Math.max(rageClickCount, existing?.rage_click_count ?? 0)
  const finalErrors = Math.max(errorCount, existing?.error_count ?? 0)

  const qualifies = finalRage > 0 || finalErrors > 0 || (scrollDepth != null && scrollDepth < 20)

  const sessionUpdate: Record<string, unknown> = {
    id: session_id,
    client_id: client.id,
    source,
    source_session_id: typeof body.source_session_id === 'string' ? body.source_session_id : session_id,
    rage_click_count: finalRage,
    error_count: finalErrors,
    scroll_depth_pct: scrollDepth,
    pii_masked: true,
    ingested_at: new Date().toISOString(),
  }

  if (qualifies && events.length > 0) {
    const r2Key = `${client.id}/${session_id}.json`
    try {
      await uploadReplayData(r2Key, { session_id, events, recorded_at: new Date().toISOString() })
      sessionUpdate.replay_url = `r2://${r2Key}`
    } catch (r2Err: any) {
      console.error('[ingest/replay] R2 upload failed:', r2Err.message)
      // Do not block: still upsert the session row
    }
  }

  const { error: upsertErr } = await supabase
    .from('us_sessions')
    .upsert(sessionUpdate, { onConflict: 'id', ignoreDuplicates: false })

  if (upsertErr) {
    console.error('[ingest/replay] session upsert failed:', upsertErr.message)
    return json({ error: 'Failed to save session' }, 500)
  }

  return json({ ok: true, stored: Boolean(sessionUpdate.replay_url), session_id })
}
