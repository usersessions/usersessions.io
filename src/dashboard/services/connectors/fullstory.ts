/**
 * FullStory Connector (Build Spec §5)
 * [LEGACY/MIGRATION ONLY] - Kept for legacy pilot clients. New clients use the first-party capture SDK.
 *
 * FullStory Segment Export API:
 *   POST /segments/export/create  → create export job
 *   GET  /segments/export/{id}    → poll until status = COMPLETED
 *   GET  (download_url)           → fetch NDJSON / CSV payload
 *
 * IMPORTANT constraint (Build Spec §5):
 *   Data Export is GATED to FullStory Enterprise plan.
 *   Confirm in discovery before promising this connector to any prospect.
 *
 * Replay URL: use FullStory's client API to generate session replay deep-links.
 * Format: https://app.fullstory.com/ui/{orgId}/session/{sessionId}
 *
 * Auth: API key in Authorization: Bearer header.
 * Org ID: stored in us_clients.session_source_app_key.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { normalizeFullStorySession } from '@/services/normalizer'
import { redactPayload, redactEndUserId, containsPII } from '@/services/pii-redactor'

const FS_BASE = 'https://api.fullstory.com/v2'

interface FSExportJob {
  id: string
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
  download_url?: string
}

interface FSSession {
  SessionId: string
  UserId?: string
  UserEmail?: string
  Created?: number   // unix ms
  Duration?: number  // ms
  PageCount?: number
  ErrorCount?: number
  FrustrationSignalCount?: number
  GeoCity?: string
  GeoCountry?: string
}

async function createExportJob(apiKey: string, orgId: string, fromMs: number, toMs: number): Promise<string> {
  const res = await fetch(`${FS_BASE}/segments/export/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'TYPE_EXPORT_SESSIONS',
      timeRange: { start: new Date(fromMs).toISOString(), end: new Date(toMs).toISOString() },
      format: 'FORMAT_NDJSON',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`FullStory export create failed ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.id ?? data.exportId
}

async function pollExportJob(apiKey: string, jobId: string, maxWaitMs = 30_000): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const res = await fetch(`${FS_BASE}/segments/export/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) break

    const job: FSExportJob = await res.json()
    if (job.status === 'COMPLETED' && job.download_url) return job.download_url
    if (job.status === 'FAILED') break

    await new Promise((r) => setTimeout(r, 2000))
  }
  return null
}

async function downloadSessions(downloadUrl: string): Promise<FSSession[]> {
  const res = await fetch(downloadUrl)
  if (!res.ok) throw new Error(`FullStory download failed ${res.status}`)
  const text = await res.text()
  // NDJSON: one JSON object per line
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as FSSession }
      catch { return null }
    })
    .filter(Boolean) as FSSession[]
}

export async function validateFullStoryCredentials(
  apiKey: string,
  orgId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${FS_BASE}/settings`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (res.status === 401) return { valid: false, error: 'Invalid API key' }
    if (res.status === 403) return { valid: false, error: 'Account may not have Data Export (requires Enterprise plan)' }
    if (!res.ok) return { valid: false, error: `FullStory returned ${res.status}` }
    return { valid: true }
  } catch (err: any) {
    return { valid: false, error: err.message }
  }
}

export async function fetchAndIngestFullStorySessions(params: {
  clientId: string
  apiKey: string
  orgId: string
  fromMs: number
  toMs: number
}): Promise<{ sessionsIngested: number; sessionIds: string[] }> {
  const { clientId, apiKey, orgId, fromMs, toMs } = params
  const supabase = createServiceClient()

  let sessions: FSSession[]
  try {
    const jobId = await createExportJob(apiKey, orgId, fromMs, toMs)
    const downloadUrl = await pollExportJob(apiKey, jobId)
    if (!downloadUrl) {
      console.warn('[connector/fullstory] Export job did not complete in time — will retry next poll')
      return { sessionsIngested: 0, sessionIds: [] }
    }
    sessions = await downloadSessions(downloadUrl)
  } catch (err: any) {
    console.error('[connector/fullstory] Fetch failed:', err.message)
    return { sessionsIngested: 0, sessionIds: [] }
  }

  if (sessions.length === 0) return { sessionsIngested: 0, sessionIds: [] }

  const sessionIds: string[] = []
  let count = 0

  for (const fs of sessions) {
    const sessionId = fs.SessionId
    if (!sessionId) continue

    // Skip already-ingested
    const { data: existing } = await supabase
      .from('us_sessions')
      .select('id')
      .eq('client_id', clientId)
      .eq('source_session_id', sessionId)
      .maybeSingle()

    if (existing) continue

    // Pre-filter: skip sessions with no qualifying signals (error or frustration)
    const errorCount = fs.ErrorCount ?? 0
    const frustrationCount = fs.FrustrationSignalCount ?? 0
    if (errorCount === 0 && frustrationCount === 0) {
      continue
    }

    const replayUrl = `https://app.fullstory.com/ui/${orgId}/session/${sessionId}`
    const normalized = normalizeFullStorySession(sessionId, fs)
    const redactedMetadata = redactPayload(fs) as Record<string, unknown>
    const piiMasked = containsPII(fs)

    const { data: session, error: sessionErr } = await supabase
      .from('us_sessions')
      .insert({
        client_id: clientId,
        source: 'fullstory',
        source_session_id: sessionId,
        replay_url: replayUrl,
        end_user_id: redactEndUserId(fs.UserId ?? null),
        started_at: fs.Created ? new Date(fs.Created).toISOString() : null,
        duration_seconds: fs.Duration ? Math.floor(fs.Duration / 1000) : null,
        error_count: fs.ErrorCount ?? 0,
        rage_click_count: fs.FrustrationSignalCount ?? 0,
        pii_masked: piiMasked,
        raw_metadata: redactedMetadata,
      })
      .select('id')
      .single()

    if (sessionErr) {
      console.error('[connector/fullstory] Session insert error:', sessionErr.message)
      continue
    }

    if (errorCount > 0 && session) {
      await supabase.from('us_events').insert({
        session_id: session.id,
        type: 'error',
        payload: { source: 'fullstory_errors', count: errorCount } as Record<string, unknown>,
        occurred_at: fs.Created ? new Date(fs.Created).toISOString() : null,
      })
    }

    // Insert a rage_click event if frustrated, so the LLM has context
    if (frustrationCount > 0 && session) {
      await supabase.from('us_events').insert({
        session_id: session.id,
        type: 'rage_click',
        payload: { source: 'fullstory_frustration', count: frustrationCount } as Record<string, unknown>,
        occurred_at: fs.Created ? new Date(fs.Created).toISOString() : null,
      })
    }

    if (session) {
      sessionIds.push(session.id)
      count++
    }
  }

  console.log(`[connector/fullstory] Ingested ${count} sessions for client ${clientId}`)
  return { sessionsIngested: count, sessionIds }
}
