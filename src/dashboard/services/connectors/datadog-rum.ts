/**
 * Datadog RUM Connector (Build Spec §5)
 * [LEGACY/MIGRATION ONLY] - Kept for legacy pilot clients. New clients use the first-party capture SDK.
 *
 * Two ingestion modes:
 *  1. Webhook: Datadog Monitor fires a POST to /api/webhooks/datadog when
 *     error-rate or frustration thresholds are breached (near-real-time).
 *  2. Poll: fallback cron every 15 min scans the last 20 min via
 *     POST /api/v2/rum/events/search.
 *
 * Both paths call fetchAndIngestSessions() which:
 *   - queries the Datadog v2 RUM API
 *   - extracts session + event data
 *   - calls the normalizer
 *   - persists to us_sessions + us_events
 *   - returns session IDs for the reasoning pipeline to process
 *
 * Known constraint (Build Spec §5): most mature, best-documented API of the
 * five — treat as the reference implementation for the connector abstraction.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { normalizeDatadogSession } from '@/services/normalizer'
import { redactPayload, redactEndUserId, containsPII } from '@/services/pii-redactor'
import type { NormalizedSession } from '@/types/usersessions'

const DD_BASE = 'https://api.datadoghq.com'

// ── Raw Datadog types (minimal — only fields we use) ──────────

interface DDRumEvent {
  id: string
  type: string
  attributes: {
    // Session-level attributes
    'session.id'?: string
    'session.duration'?: number           // milliseconds
    'session.error.count'?: number
    'session.frustration.count'?: number
    'usr.id'?: string
    'usr.email'?: string
    'view.url'?: string
    // Event-level attributes
    'error.message'?: string
    'error.type'?: string
    'error.stack'?: string
    'http.url'?: string
    'http.status_code'?: number
    'http.method'?: string
    '@type'?: string
    [key: string]: unknown
  }
}

interface DDSearchResponse {
  data: DDRumEvent[]
  meta?: { page?: { after?: string } }
}

// ── Datadog API client ─────────────────────────────────────────

function ddHeaders(apiKey: string, appKey: string) {
  return {
    'DD-API-KEY': apiKey,
    'DD-APPLICATION-KEY': appKey,
    'Content-Type': 'application/json',
  }
}

/**
 * Search RUM events in a rolling time window.
 * Returns raw events grouped by session.
 * Handles cursor-based pagination (up to 200 sessions per call).
 */
async function searchRumSessions(
  apiKey: string,
  appKey: string,
  fromMs: number,
  toMs: number,
): Promise<Map<string, DDRumEvent[]>> {
  const sessionMap = new Map<string, DDRumEvent[]>()
  let cursor: string | undefined

  // First query: fetch session-level events with error/frustration filter
  const body = {
    filter: {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      query: '@type:session (@session.error.count:>0 OR @session.frustration.count:>0)',
    },
    page: { limit: 1000 },
    sort: '@session.last_view.time',
  }

  do {
    const payload = cursor ? { ...body, page: { limit: 1000, cursor } } : body
    const res = await fetch(`${DD_BASE}/api/v2/rum/events/search`, {
      method: 'POST',
      headers: ddHeaders(apiKey, appKey),
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Datadog RUM API error ${res.status}: ${txt}`)
    }

    const data: DDSearchResponse = await res.json()
    for (const evt of data.data) {
      const sessionId = evt.attributes['session.id'] ?? evt.id
      if (!sessionMap.has(sessionId)) sessionMap.set(sessionId, [])
      sessionMap.get(sessionId)!.push(evt)
    }

    cursor = data.meta?.page?.after
  } while (cursor)

  return sessionMap
}

/**
 * Fetch error and action events for a specific session.
 * Called per session to build the Event list for the reasoning layer.
 */
async function fetchSessionEvents(
  apiKey: string,
  appKey: string,
  sessionId: string,
  fromMs: number,
  toMs: number,
): Promise<DDRumEvent[]> {
  const res = await fetch(`${DD_BASE}/api/v2/rum/events/search`, {
    method: 'POST',
    headers: ddHeaders(apiKey, appKey),
    body: JSON.stringify({
      filter: {
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        query: `@session.id:${sessionId} @type:(error OR action)`,
      },
      page: { limit: 500 },
    }),
  })
  if (!res.ok) return []
  const data: DDSearchResponse = await res.json()
  return data.data
}

// ── Validate credentials ───────────────────────────────────────

/**
 * Lightweight credential check — queries the last 5 min of sessions.
 * Returns true if the credentials are valid and the app has RUM data.
 */
export async function validateDatadogCredentials(
  apiKey: string,
  appKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const to = Date.now()
    const from = to - 5 * 60 * 1000 // 5 min window
    const res = await fetch(`${DD_BASE}/api/v2/rum/events/search`, {
      method: 'POST',
      headers: ddHeaders(apiKey, appKey),
      body: JSON.stringify({
        filter: {
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
          query: '@type:session',
        },
        page: { limit: 1 },
      }),
    })
    if (res.status === 403) return { valid: false, error: 'Invalid API key or missing RUM Read permissions' }
    if (!res.ok) return { valid: false, error: `Datadog API returned ${res.status}` }
    return { valid: true }
  } catch (err: any) {
    return { valid: false, error: err.message }
  }
}

// ── Main ingestion entry point ─────────────────────────────────

export interface IngestResult {
  sessionsIngested: number
  sessionIds: string[]   // us_sessions.id values — passed to reasoning pipeline
  errors: string[]
}

/**
 * Core ingestion function — called by both the webhook receiver and the cron.
 * Polls Datadog for the given time window, normalizes, and persists.
 */
export async function fetchAndIngestSessions(params: {
  clientId: string
  apiKey: string
  appKey: string
  /** Window start (epoch ms). Defaults to 20 min ago. */
  fromMs?: number
  /** Window end (epoch ms). Defaults to now. */
  toMs?: number
}): Promise<IngestResult> {
  const supabase = createServiceClient()
  const toMs = params.toMs ?? Date.now()
  const fromMs = params.fromMs ?? (toMs - 20 * 60 * 1000)
  const errors: string[] = []
  const sessionIds: string[] = []

  // 1. Fetch sessions with errors/frustration from Datadog
  let sessionMap: Map<string, DDRumEvent[]>
  try {
    sessionMap = await searchRumSessions(params.apiKey, params.appKey, fromMs, toMs)
  } catch (err: any) {
    return { sessionsIngested: 0, sessionIds: [], errors: [err.message] }
  }

  console.log(`[datadog-rum] fetched ${sessionMap.size} sessions for client ${params.clientId}`)

  // 2. For each session: fetch events, normalize, persist
  for (const [ddSessionId, sessionEvents] of sessionMap) {
    try {
      // Fetch detailed error/action events for this session
      const detailEvents = await fetchSessionEvents(
        params.apiKey,
        params.appKey,
        ddSessionId,
        fromMs,
        toMs,
      )

      // Combine session-level summary with detailed events
      const allEvents = [...sessionEvents, ...detailEvents]

      // Normalize to common schema
      const normalized: NormalizedSession = normalizeDatadogSession(ddSessionId, allEvents)

      // PII redaction (Build Spec §15) — strip before persisting to DB
      const redactedMetadata = redactPayload(normalized.raw_metadata) as Record<string, unknown>
      let piiWasPresent = containsPII(normalized.raw_metadata)

      const redactedEvents = normalized.events.map((e) => {
        const redactedPayload = redactPayload(e.payload)
        if (!piiWasPresent && containsPII(e.payload)) piiWasPresent = true
        return {
          session_id: undefined, // Will be set after session insert
          type: e.type,
          payload: redactedPayload as Record<string, unknown>,
          occurred_at: e.occurred_at,
        }
      })

      // Was this session already ingested? us_events has no natural unique key, so
      // events are written only on first insert; re-polls just refresh the counters.
      const { data: priorSession } = await supabase
        .from('us_sessions')
        .select('id')
        .eq('client_id', params.clientId)
        .eq('source', 'datadog_rum')
        .eq('source_session_id', normalized.source_session_id)
        .maybeSingle()

      // Persist session
      const { data: session, error: sessionErr } = await supabase
        .from('us_sessions')
        .upsert(
          {
            client_id: params.clientId,
            source: 'datadog_rum',
            source_session_id: normalized.source_session_id,
            replay_url: normalized.replay_url,
            end_user_id: redactEndUserId(normalized.end_user_id),
            started_at: normalized.started_at,
            duration_seconds: normalized.duration_seconds,
            error_count: normalized.error_count,
            rage_click_count: normalized.rage_click_count,
            pii_masked: piiWasPresent,
            raw_metadata: redactedMetadata,
          },
          {
            onConflict: 'client_id,source,source_session_id',
            ignoreDuplicates: false,  // always update error counts on re-ingestion
          },
        )
        .select('id')
        .single()

      if (sessionErr || !session) {
        errors.push(`Session ${ddSessionId}: ${sessionErr?.message ?? 'upsert failed'}`)
        continue
      }

      if (!priorSession && redactedEvents.length > 0) {
        const eventsToInsert = redactedEvents.map((e) => ({ ...e, session_id: session.id }))
        const { error: evErr } = await supabase.from('us_events').insert(eventsToInsert)
        if (evErr) errors.push(`Session ${ddSessionId} events: ${evErr.message}`)
      }

      // Only hand NEW sessions to the reasoning pipeline (it also dedupes on findings)
      if (!priorSession) sessionIds.push(session.id)
    } catch (err: any) {
      errors.push(`Session ${ddSessionId}: ${err.message}`)
    }
  }

  if (errors.length > 0) {
    console.warn(`[datadog-rum] ${errors.length} errors during ingestion for client ${params.clientId}:`, errors)
  }

  return { sessionsIngested: sessionIds.length, sessionIds, errors }
}
