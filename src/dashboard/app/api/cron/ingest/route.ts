/**
 * GET /api/cron/ingest — fallback polling cron (Build Spec §11)
 *
 * Fires every 15 minutes as a safety net if a Datadog Monitor webhook
 * is not configured. Also functions as the billing meter cron.
 * Handles Datadog RUM, PostHog, FullStory and first-party (capture.js) clients.
 *
 * Secured with CRON_SECRET via lib/cron.ts (header only, fail closed).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAndIngestSessions } from '@/services/connectors/datadog-rum'
import { fetchAndIngestPostHogSessions } from '@/services/connectors/posthog'
import { fetchAndIngestFullStorySessions } from '@/services/connectors/fullstory'
import { recordBillingEvents } from '@/services/billing-meter'
import { Client as QStashClient } from '@upstash/qstash'
import { authorizeCron } from '@/lib/cron'

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN || 'dummy' })
const getPipelineUrl = () => {
  const host = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${host}/api/queue/pipeline`
}

export const dynamic = 'force-dynamic'

const FIRST_PARTY_BATCH = 500

export async function GET(req: NextRequest) {
  // Header-only auth (Bearer or x-cron-secret). Query-string secrets leak into logs and are rejected.
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const fromMs = Date.now() - 20 * 60 * 1000
  const toMs = Date.now()
  let totalSessions = 0

  // ── Datadog RUM clients ──────────────────────────────────────────
  const { data: ddClients } = await supabase
    .from('us_clients')
    .select('id, session_source_api_key, session_source_app_key')
    .eq('connected_session_source', 'datadog_rum')
    .not('session_source_api_key', 'is', null)

  for (const client of ddClients ?? []) {
    const ingested = await fetchAndIngestSessions({
      clientId: client.id,
      apiKey: client.session_source_api_key!,
      appKey: client.session_source_app_key ?? '',
      fromMs,
      toMs,
    })
    if (ingested.sessionIds.length > 0) {
      await qstash.publishJSON({
        url: getPipelineUrl(),
        body: { clientId: client.id, sessionIds: ingested.sessionIds },
      }).catch(err => console.error('[cron:ingest] QStash DD publish failed', err))
    }
    totalSessions += ingested.sessionsIngested
  }

  // ── PostHog clients ──────────────────────────────────────────────
  // session_source_api_key = PostHog API key
  // session_source_app_key = PostHog Project ID
  const { data: phClients } = await supabase
    .from('us_clients')
    .select('id, session_source_api_key, session_source_app_key')
    .eq('connected_session_source', 'posthog')
    .not('session_source_api_key', 'is', null)
    .not('session_source_app_key', 'is', null)

  for (const client of phClients ?? []) {
    const ingested = await fetchAndIngestPostHogSessions({
      clientId: client.id,
      apiKey: client.session_source_api_key!,
      projectId: client.session_source_app_key!,
      fromMs,
      toMs,
    })
    if (ingested.sessionIds.length > 0) {
      await qstash.publishJSON({
        url: getPipelineUrl(),
        body: { clientId: client.id, sessionIds: ingested.sessionIds },
      }).catch(err => console.error('[cron:ingest] QStash PH publish failed', err))
    }
    totalSessions += ingested.sessionsIngested
  }

  // ── FullStory clients ────────────────────────────────────────────
  // session_source_api_key = FullStory API key
  // session_source_app_key = FullStory Org ID
  const { data: fsClients } = await supabase
    .from('us_clients')
    .select('id, session_source_api_key, session_source_app_key')
    .eq('connected_session_source', 'fullstory')
    .not('session_source_api_key', 'is', null)
    .not('session_source_app_key', 'is', null)

  for (const client of fsClients ?? []) {
    const ingested = await fetchAndIngestFullStorySessions({
      clientId: client.id,
      apiKey: client.session_source_api_key!,
      orgId: client.session_source_app_key!,
      fromMs,
      toMs,
    })
    if (ingested.sessionIds.length > 0) {
      await qstash.publishJSON({
        url: getPipelineUrl(),
        body: { clientId: client.id, sessionIds: ingested.sessionIds },
      }).catch(err => console.error('[cron:ingest] QStash FS publish failed', err))
    }
    totalSessions += ingested.sessionsIngested
  }

  // ── First-party (capture.js) sessions ──────────────────────────────
  // The ingest routes are hot paths and never call the AI. Pick up sessions
  // with qualifying signals (errors or rage clicks) that have no finding yet.
  // capture.js refreshes ingested_at on every flush, so an active session stays
  // inside the 20-minute window until it goes idle.
  let firstPartyClassified = 0
  try {
    const { data: fpSessions } = await supabase
      .from('us_sessions')
      .select('id, client_id')
      .eq('source', 'first_party')
      .gte('ingested_at', new Date(fromMs).toISOString())
      .or('error_count.gt.0,rage_click_count.gt.0')
      .order('ingested_at', { ascending: false })
      .limit(FIRST_PARTY_BATCH)

    if (fpSessions && fpSessions.length > 0) {
      const ids = fpSessions.map((s) => s.id)
      const { data: existingFindings } = await supabase
        .from('us_findings')
        .select('session_id')
        .in('session_id', ids)
      const alreadyClassified = new Set((existingFindings ?? []).map((f) => f.session_id))

      const byClient = new Map<string, string[]>()
      for (const s of fpSessions) {
        if (alreadyClassified.has(s.id)) continue
        byClient.set(s.client_id, [...(byClient.get(s.client_id) ?? []), s.id])
      }

      for (const [clientId, sessionIds] of byClient) {
        await qstash.publishJSON({
          url: getPipelineUrl(),
          body: { clientId, sessionIds },
        }).catch(err => console.error('[cron:ingest] QStash 1P publish failed', err))
        firstPartyClassified += sessionIds.length
      }
    }
  } catch (err) {
    console.error('[cron:ingest] first-party classification failed:', err)
  }

  // ── Billing meter ────────────────────────────────────────────────
  const billing = await recordBillingEvents()

  // ── Daily Friction Digest ────────────────────────────────────────
  let digestsSent = 0
  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const { data: allClients } = await supabase
      .from('us_clients')
      .select('id, profile_id')

    if (allClients) {
      for (const client of allClients) {
        const { data: existingDigest } = await supabase
          .from('us_notification_events')
          .select('id')
          .eq('client_id', client.id)
          .eq('event_type', 'daily_digest')
          .gte('created_at', today.toISOString())
          .limit(1)

        if (!existingDigest || existingDigest.length === 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('id', client.profile_id)
            .maybeSingle()

          if (profile && profile.email) {
            const { dispatch } = await import('@/lib/notifications/dispatch')
            await dispatch({
              event_type: 'daily_digest',
              source_type: 'system',
              source_id: `digest-${today.toISOString().split('T')[0]}`,
              client_id: client.id,
              recipient_user_id: profile.id,
              recipient_email: profile.email,
              metadata: { date: today.toISOString().split('T')[0] },
            })
            digestsSent++
          }
        }
      }
    }
  } catch (err) {
    console.error('[cron:ingest] Error sending daily digests:', err)
  }

  return NextResponse.json({
    message: 'Ingest cron complete',
    sessionsIngested: totalSessions,
    firstPartyClassified,
    billingEventsRecorded: billing.recorded,
    billingEventsSkipped: billing.skipped,
    digestsSent,
  })
}
