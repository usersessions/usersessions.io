/**
 * Normalizer — maps vendor-specific session+event data to the common schema.
 *
 * Each vendor function takes raw API data and returns a NormalizedSession.
 * Datadog RUM, PostHog, and FullStory are implemented. Stubs are provided 
 * for LogRocket and Hotjar so the pipeline compiles and the connector abstraction is
 * established before the next vendor is needed.
 */

import type { NormalizedSession, EventType } from '@/types/usersessions'

// ── Datadog RUM normalizer ─────────────────────────────────────

interface DDRawEvent {
  id: string
  type: string
  attributes: Record<string, unknown>
}

/**
 * Maps Datadog RUM API events (mixed type: session, error, action) for a
 * single session into the common NormalizedSession shape.
 */
export function normalizeDatadogSession(
  ddSessionId: string,
  events: DDRawEvent[],
): NormalizedSession {
  // Find the session-type event (summary record)
  const sessionEvent = events.find(
    (e) => e.attributes['@type'] === 'session' || e.attributes['session.id'] === ddSessionId,
  )
  const attrs = sessionEvent?.attributes ?? {}

  // Build replay URL — Datadog's native session replay deep-link pattern
  // Per Build Spec §5: use the metadata/list API + PostHog's native replay URL
  // (same principle here — use Datadog's built-in replay URL, don't depend on raw snapshots)
  const replayUrl = attrs['session.replay_url'] as string | null
    ?? (ddSessionId ? `https://app.datadoghq.com/rum/replay/sessions/${ddSessionId}` : null)

  // Duration: Datadog reports in milliseconds
  const durationMs = attrs['session.duration'] as number | null ?? null
  const durationSeconds = durationMs != null ? Math.round(durationMs / 1000) : null

  // Error and frustration counts
  const errorCount = (attrs['session.error.count'] as number | null) ?? 0
  const rageClickCount = (attrs['session.frustration.count'] as number | null) ?? 0

  // End-user identity — may be hashed by client's FS.identify equivalent
  const endUserId =
    (attrs['usr.id'] as string | null) ??
    (attrs['usr.email'] as string | null) ??
    null

  // Session start time
  const startedAt =
    (attrs['session.start'] as string | null) ??
    (attrs['date'] as string | null) ??
    null

  // Normalize individual error/action events
  const normalizedEvents = events
    .filter((e) => {
      const t = e.attributes['@type'] as string | undefined
      return t === 'error' || t === 'action'
    })
    .map((e) => {
      const a = e.attributes
      const ddType = a['@type'] as string

      let type: EventType
      if (ddType === 'error') {
        const errorType = a['error.type'] as string | undefined
        type = errorType?.toLowerCase().includes('network') ? 'network_fail' : 'error'
      } else if (ddType === 'action') {
        const actionType = a['action.type'] as string | undefined
        if (actionType === 'frustration') type = 'rage_click'
        else if (actionType === 'dead_click') type = 'dead_click'
        else type = 'click'
      } else {
        type = 'page_view'
      }

      return {
        type,
        payload: {
          error_message: a['error.message'] ?? null,
          error_type: a['error.type'] ?? null,
          error_stack: a['error.stack'] ?? null,
          http_url: a['http.url'] ?? null,
          http_status: a['http.status_code'] ?? null,
          http_method: a['http.method'] ?? null,
          view_url: a['view.url'] ?? null,
          action_type: a['action.type'] ?? null,
        } as Record<string, unknown>,
        occurred_at: (a['date'] as string | null) ?? null,
      }
    })

  return {
    source: 'datadog_rum',
    source_session_id: ddSessionId,
    replay_url: replayUrl,
    end_user_id: endUserId,
    started_at: startedAt,
    duration_seconds: durationSeconds,
    error_count: errorCount,
    rage_click_count: rageClickCount,
    events: normalizedEvents,
    raw_metadata: attrs,
  }
}

// ── PostHog normalizer ────────────────────────────────────────

interface PHRaw {
  id: string
  duration?: number | null
  distinct_id?: string | null
  start_time?: string | null
  click_count?: number
  console_error_count?: number
  person?: { id?: string; name?: string; properties?: Record<string, unknown> }
}

export function normalizePostHogSession(sessionId: string, raw: unknown): NormalizedSession {
  const r = raw as PHRaw
  return {
    source: 'posthog',
    source_session_id: sessionId,
    replay_url: null,  // caller sets this — PostHog replay URL requires projectId
    end_user_id: r.distinct_id ?? null,
    started_at: r.start_time ?? null,
    duration_seconds: r.duration != null ? Math.floor(r.duration) : null,
    error_count: r.console_error_count ?? 0,
    rage_click_count: 0,  // PostHog list API doesn't expose rage clicks directly
    events: r.console_error_count && r.console_error_count > 0
      ? [{ type: 'error' as EventType, payload: { source: 'posthog_console', count: r.console_error_count }, occurred_at: r.start_time ?? null }]
      : [],
    raw_metadata: raw as Record<string, unknown>,
  }
}

// ── FullStory normalizer ──────────────────────────────────────

interface FSRaw {
  SessionId: string
  UserId?: string
  UserEmail?: string
  Created?: number
  Duration?: number
  ErrorCount?: number
  FrustrationSignalCount?: number
}

export function normalizeFullStorySession(sessionId: string, raw: unknown): NormalizedSession {
  const r = raw as FSRaw
  return {
    source: 'fullstory',
    source_session_id: sessionId,
    replay_url: null,  // caller sets this — requires orgId
    end_user_id: r.UserId ?? null,
    started_at: r.Created ? new Date(r.Created).toISOString() : null,
    duration_seconds: r.Duration ? Math.floor(r.Duration / 1000) : null,
    error_count: r.ErrorCount ?? 0,
    rage_click_count: r.FrustrationSignalCount ?? 0,
    events: r.ErrorCount && r.ErrorCount > 0
      ? [{ type: 'error' as EventType, payload: { source: 'fullstory_errors', count: r.ErrorCount }, occurred_at: r.Created ? new Date(r.Created).toISOString() : null }]
      : [],
    raw_metadata: raw as Record<string, unknown>,
  }
}

export function normalizeLogRocketSession(_sessionId: string, _raw: unknown): NormalizedSession {
  console.warn('[normalizer] LogRocket connector not yet implemented — validate API surface before building')
  return _emptySession('logrocket', String(_sessionId))
}

export function normalizeHotjarSession(_sessionId: string, _raw: unknown): NormalizedSession {
  console.warn('[normalizer] Hotjar connector not yet implemented — build only when a pilot needs it (Tier 2/best-effort per Build Spec)')
  return _emptySession('hotjar', String(_sessionId))
}

function _emptySession(
  source: NormalizedSession['source'],
  sessionId: string,
): NormalizedSession {
  return {
    source,
    source_session_id: sessionId,
    replay_url: null,
    end_user_id: null,
    started_at: null,
    duration_seconds: null,
    error_count: 0,
    rage_click_count: 0,
    events: [],
    raw_metadata: {},
  }
}
