/**
 * Datadog Monitor webhook receiver (Build Spec §5)
 *
 * Datadog fires this endpoint when a Monitor (RUM error-rate or frustration
 * threshold) is breached. This gives near-real-time ingestion without polling.
 *
 * Webhook setup in Datadog:
 *   Monitors → [your monitor] → Notifications → @webhook-usersessions
 *   URL: https://usersessions.io/api/webhooks/datadog
 *   Method: POST
 *   Custom Payload: {"monitor_id": "{{monitor.id}}", "org": "{{account.name}}"}
 *
 * Security: Datadog webhooks support a shared secret sent in a custom header.
 * Set DATADOG_WEBHOOK_SECRET in your env and the Datadog webhook config.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAndIngestSessions } from '@/services/connectors/datadog-rum'
import { Client as QStashClient } from '@upstash/qstash'
const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN || 'dummy' })
const getPipelineUrl = () => {
  const host = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${host}/api/queue/pipeline`
}
import { constantTimeEqual, getStrongSecret } from '@/lib/secrets'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // FAIL CLOSED: this endpoint triggers paid vendor API calls and AI classification
  // for every Datadog client, so an unverified caller must never reach it.
  const secret = getStrongSecret('DATADOG_WEBHOOK_SECRET')
  const provided = req.headers.get('x-datadog-webhook-secret') ?? ''
  if (!secret || !provided || !constantTimeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  console.log('[webhook/datadog] Received trigger:', JSON.stringify(body))

  // Find all clients using Datadog RUM
  const supabase = createServiceClient()
  const { data: clients, error } = await supabase
    .from('us_clients')
    .select('id, session_source_api_key, session_source_app_key')
    .eq('connected_session_source', 'datadog_rum')
    .not('session_source_api_key', 'is', null)

  if (error || !clients?.length) {
    return NextResponse.json({ message: 'No Datadog RUM clients configured', ingested: 0 })
  }

  // Ingest for all clients concurrently (each has their own API keys)
  const results = await Promise.allSettled(
    clients.map(async (client) => {
      const ingested = await fetchAndIngestSessions({
        clientId: client.id,
        apiKey: client.session_source_api_key!,
        appKey: client.session_source_app_key ?? '',
        fromMs: Date.now() - 20 * 60 * 1000,   // last 20 min
        toMs: Date.now(),
      })

      // Run classification pipeline on newly ingested sessions
      if (ingested.sessionIds.length > 0) {
        await qstash.publishJSON({
          url: getPipelineUrl(),
          body: {
            clientId: client.id,
            sessionIds: ingested.sessionIds,
          }
        }).catch(err => console.error('[webhook:datadog] QStash publish failed', err))
      }

      return ingested
    }),
  )

  const totalIngested = results.reduce((sum, r) => {
    return sum + (r.status === 'fulfilled' ? r.value.sessionsIngested : 0)
  }, 0)

  return NextResponse.json({ message: 'OK', sessionsIngested: totalIngested })
}
