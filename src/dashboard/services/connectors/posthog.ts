/**
 * PostHog Connector (Build Spec §5)
 * [LEGACY/MIGRATION ONLY] - Kept for legacy pilot clients. New clients use the first-party capture SDK.
 *
 * Ingestion via PostHog Session Recordings API:
 *   GET /api/projects/{project_id}/session_recordings
 *
 * Per Build Spec constraint: use the metadata/list API + PostHog's native
 * replay URL for deep-linking. Do NOT depend on the raw snapshot endpoint
 * (explicitly flagged as unstable in spec §5).
 *
 * Poll only — PostHog does not support outbound webhooks for session data.
 * Default cadence: every 15 min via the ingest cron.
 *
 * Auth: Personal or Project API key. Set in us_clients.session_source_api_key.
 * Project ID: stored in us_clients.session_source_app_key (re-using the field).
 */

import { createServiceClient } from '@/lib/supabase/server'
import { normalizePostHogSession } from '@/services/normalizer'
import { redactPayload, redactEndUserId, containsPII } from '@/services/pii-redactor'
import type { NormalizedSession } from '@/types/usersessions'

const POSTHOG_BASE = process.env.POSTHOG_API_HOST || 'https://app.posthog.com'

interface PHRecording {
  id: string
  distinct_id: string | null
  start_time: string
  end_time: string | null
  duration: number | null
  click_count: number
  keypress_count: number
  mouse_activity_count: number
  console_error_count: number
  active_seconds: number | null
  person?: {
    id?: string
    name?: string
    properties?: Record<string, unknown>
  }
  viewed?: boolean
}

interface PHRecordingsResponse {
  results: PHRecording[]
  next: string | null
}

async function fetchRecordings(
  apiKey: string,
  projectId: string,
  afterDate: Date,
): Promise<PHRecording[]> {
  const params = new URLSearchParams({
    limit: '50',
    order: '-start_time',
    // Only fetch sessions from the last polling window
    date_from: afterDate.toISOString(),
  })

  const url = `${POSTHOG_BASE}/api/projects/${projectId}/session_recordings?${params}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PostHog API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data: PHRecordingsResponse = await res.json()
  return data.results ?? []
}

export async function validatePostHogCredentials(
  apiKey: string,
  projectId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${POSTHOG_BASE}/api/projects/${projectId}/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (res.status === 401) return { valid: false, error: 'Invalid API key' }
    if (res.status === 404) return { valid: false, error: 'Project not found — check project ID' }
    if (!res.ok) return { valid: false, error: `PostHog returned ${res.status}` }
    return { valid: true }
  } catch (err: any) {
    return { valid: false, error: err.message }
  }
}

export async function fetchAndIngestPostHogSessions(params: {
  clientId: string
  apiKey: string
  projectId: string
  fromMs: number
  toMs: number
}): Promise<{ sessionsIngested: number; sessionIds: string[] }> {
  const { clientId, apiKey, projectId, fromMs } = params
  const supabase = createServiceClient()

  let recordings: PHRecording[]
  try {
    recordings = await fetchRecordings(apiKey, projectId, new Date(fromMs))
  } catch (err: any) {
    console.error('[connector/posthog] Fetch failed:', err.message)
    return { sessionsIngested: 0, sessionIds: [] }
  }

  if (recordings.length === 0) return { sessionsIngested: 0, sessionIds: [] }

  const sessionIds: string[] = []
  let count = 0

  for (const recording of recordings) {
    const sessionId = recording.id

    // Skip already-ingested sessions
    const { data: existing } = await supabase
      .from('us_sessions')
      .select('id')
      .eq('client_id', clientId)
      .eq('source_session_id', sessionId)
      .maybeSingle()

    if (existing) continue

    // Pre-filter: skip sessions with no qualifying signals (error or frustration)
    const isFrustrated = recording.click_count >= 30
    if (recording.console_error_count === 0 && !isFrustrated) {
      continue
    }

    // Build replay URL — PostHog native deep-link pattern
    const replayUrl = `${POSTHOG_BASE}/replay/${sessionId}?selected_recording_id=${sessionId}`

    // Normalize + redact
    const rawForNormalizer = {
      id: sessionId,
      duration: recording.duration,
      distinct_id: recording.distinct_id,
      start_time: recording.start_time,
      click_count: recording.click_count,
      console_error_count: recording.console_error_count,
      person: recording.person,
    }

    const normalized = normalizePostHogSession(sessionId, rawForNormalizer)
    const redactedMetadata = redactPayload(normalized.raw_metadata) as Record<string, unknown>
    const piiMasked = containsPII(rawForNormalizer)

    // Persist session
    const { data: session, error: sessionErr } = await supabase
      .from('us_sessions')
      .insert({
        client_id: clientId,
        source: 'posthog',
        source_session_id: sessionId,
        replay_url: replayUrl,
        end_user_id: redactEndUserId(recording.distinct_id),
        started_at: recording.start_time || null,
        duration_seconds: recording.duration ? Math.floor(recording.duration) : null,
        error_count: recording.console_error_count ?? 0,
        rage_click_count: isFrustrated ? 1 : 0, // Using click_count >= 30 as a heuristic for rage clicks
        pii_masked: piiMasked,
        raw_metadata: redactedMetadata,
      })
      .select('id')
      .single()

    if (sessionErr) {
      console.error('[connector/posthog] Session insert error:', sessionErr.message)
      continue
    }

    // Persist events (minimal — just console errors as 'error' type events)
    if (recording.console_error_count > 0 && session) {
      await supabase.from('us_events').insert({
        session_id: session.id,
        type: 'error',
        payload: redactPayload({
          source: 'posthog_console_errors',
          count: recording.console_error_count,
        }) as Record<string, unknown>,
        occurred_at: recording.start_time || null,
      })
    }

    // Insert a rage_click event if frustrated, so the LLM has context
    if (isFrustrated && session) {
      await supabase.from('us_events').insert({
        session_id: session.id,
        type: 'rage_click',
        payload: {
          source: 'posthog_click_heuristic',
          total_clicks: recording.click_count
        },
        occurred_at: recording.start_time || null,
      })
    }

    if (session) {
      sessionIds.push(session.id)
      count++
    }
  }

  console.log(`[connector/posthog] Ingested ${count} sessions for client ${clientId}`)
  return { sessionsIngested: count, sessionIds }
}
