import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BODY_BYTES = 512 * 1024
const MAX_RAGE_CLICKS = 50
const MAX_ERRORS = 10
const MAX_POINTS = 500

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS })
}

function clampInt(v: unknown, max = 100_000): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), max)
}

// Allow cross-origin POST from any domain (capture script runs on customers' sites)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Headers': 'Content-Type' } })
}

/**
 * POST /api/ingest/heatmap
 *
 * Called by capture.js every 15s and on pagehide (sendBeacon => text/plain body).
 * Order matters: us_events has an FK to us_sessions, so the session row is
 * written FIRST. Counters in `data.totals` are cumulative for the session so the
 * upsert is idempotent across flushes.
 */
export async function POST(req: Request) {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413)

  let payload: any
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413)
    payload = JSON.parse(text)
  } catch {
    return json({ error: 'Invalid payload' }, 400)
  }

  const { clientId: capturePublicKey, sessionId, url, viewport, data } = payload ?? {}
  if (
    typeof capturePublicKey !== 'string' || typeof sessionId !== 'string' ||
    typeof url !== 'string' || typeof viewport !== 'string' || !data || typeof data !== 'object'
  ) {
    return json({ error: 'Missing required fields' }, 400)
  }
  if (!UUID_RE.test(sessionId)) return json({ error: 'sessionId must be a UUID' }, 400)
  if (url.length > 2048) return json({ error: 'url too long' }, 400)

  if (!rateLimit(`heatmap:${capturePublicKey}`, 1200, 60_000)) {
    return json({ error: 'Too many requests' }, 429)
  }

  const supabase = createServiceClient()

  // Resolve the public key to the internal client UUID
  const { data: clientRow, error: clientLookupErr } = await supabase
    .from('us_clients')
    .select('id, script_installed_at')
    .eq('capture_public_key', capturePublicKey)
    .maybeSingle()

  if (clientLookupErr || !clientRow) return json({ error: 'Invalid client key' }, 401)
  const clientId = clientRow.id

  // A session id may only ever belong to one client
  const { data: existingSession } = await supabase
    .from('us_sessions')
    .select('client_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (existingSession && existingSession.client_id !== clientId) {
    return json({ error: 'Session belongs to another client' }, 403)
  }

  const totals = (data.totals && typeof data.totals === 'object') ? data.totals : {}
  const rageClicks: any[] = Array.isArray(data.rageClicks) ? data.rageClicks.slice(0, MAX_RAGE_CLICKS) : []
  const errors: any[] = Array.isArray(data.errors) ? data.errors.slice(0, MAX_ERRORS) : []

  const rageClickCount = clampInt(totals.rageClicks ?? rageClicks.length)
  const errorCount = clampInt(totals.jsErrors ?? data.patchMetrics?.global?.jsErrors ?? errors.length)
  const scrollDepth = typeof data.maxScrollDepth === 'number'
    ? Math.max(0, Math.min(100, Math.round(data.maxScrollDepth)))
    : null

  const now = new Date().toISOString()

  // 1. Session row FIRST (us_events.session_id -> us_sessions.id)
  const { error: sessionErr } = await supabase.from('us_sessions').upsert({
    id: sessionId,
    client_id: clientId,
    source: 'crawler',
    source_session_id: sessionId,
    ingested_at: now,
    pii_masked: true,
    rage_click_count: rageClickCount,
    error_count: errorCount,
    scroll_depth_pct: scrollDepth,
    raw_metadata: {
      viewport,
      appliedPatches: Array.isArray(data.appliedPatches) ? data.appliedPatches.slice(0, 50) : [],
      patchMetrics: data.patchMetrics && typeof data.patchMetrics === 'object' ? data.patchMetrics : {},
    },
  }, { onConflict: 'id' })

  if (sessionErr) {
    console.error('[Ingest] session upsert failed:', sessionErr.message)
    return json({ error: 'Database error' }, 500)
  }

  // 2. Events
  const eventsToInsert: Array<Record<string, unknown>> = []

  for (const rc of rageClicks) {
    const t = Number(rc?.time)
    eventsToInsert.push({
      session_id: sessionId,
      type: 'rage_click',
      payload: { x: clampInt(rc?.x, 100_000), y: clampInt(rc?.y, 1_000_000), path: String(rc?.path ?? '').slice(0, 1000), url },
      occurred_at: Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : now,
    })
  }

  for (const e of errors) {
    const t = Number(e?.time)
    eventsToInsert.push({
      session_id: sessionId,
      type: 'error',
      payload: {
        error_type: 'js_error',
        error_message: String(e?.message ?? 'Unknown error').slice(0, 500),
        source: typeof e?.source === 'string' ? e.source.slice(0, 500) : null,
        line: Number.isFinite(Number(e?.line)) ? Number(e.line) : null,
        url,
      },
      occurred_at: Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : now,
    })
  }

  eventsToInsert.push({
    session_id: sessionId,
    type: 'page_view',
    payload: {
      url,
      viewport,
      maxScrollDepth: scrollDepth,
      clicks: Array.isArray(data.clicks) ? data.clicks.slice(0, MAX_POINTS) : [],
      mouseMoves: Array.isArray(data.mouseMoves) ? data.mouseMoves.slice(0, MAX_POINTS) : [],
    },
    occurred_at: now,
  })

  const { error: eventsErr } = await supabase.from('us_events').insert(eventsToInsert)
  if (eventsErr) {
    console.error('[Ingest] events insert failed:', eventsErr.message)
    return json({ error: 'Database error' }, 500)
  }

  // 3. Activation: mark script as installed on first-ever event
  if (!clientRow.script_installed_at) {
    await supabase
      .from('us_clients')
      .update({ script_installed_at: now, activation_step: 'script_verified' })
      .eq('id', clientId)

    await supabase.from('us_activation_events').upsert({
      client_id: clientId,
      step: 'script_verified',
      metadata: { url, first_session_id: sessionId },
    }, { onConflict: 'client_id,step' })
  }

  // Classification is NOT run here (hot path). cron/ingest picks up sessions with signals.
  return json({ success: true, qualifies: rageClickCount > 0 || errorCount > 0 })
}
