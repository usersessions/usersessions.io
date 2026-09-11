import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmailForEvent } from '@/lib/notifications/channel-email'
import type { DispatchPayload } from '@/lib/notifications/types'
import { findingActionUrls, integrationReconnectUrl } from '@/lib/notifications/signed-actions'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * POST /api/notify/escalation
 *
 * Called by the cron job every 4 hours.
 * Finds all notification events where:
 *   - escalation_due_at < NOW()
 *   - actioned_at IS NULL   (not yet resolved)
 *   - escalation_sent_at IS NULL (escalation not yet fired)
 * Then fires an email escalation and marks it sent.
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Load overdue unactioned events
  const { data: overdueEvents, error } = await supabase
    .from('us_notification_events')
    .select('*')
    .lt('escalation_due_at', new Date().toISOString())
    .is('actioned_at', null)
    .is('escalation_sent_at', null)
    .in('event_type', ['finding_pending_approval', 'action_failed'])
    .limit(50)

  if (error) {
    console.error('[escalation] query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ id: string; status: string }> = []

  for (const event of overdueEvents ?? []) {
    try {
      // Build signed action URLs for finding escalations
      let approveUrl = ''
      let dismissUrl = ''
      let reconnectUrl = ''

      if (event.event_type === 'finding_pending_approval' && event.source_id && event.recipient_user_id) {
        const urls = await findingActionUrls(event.source_id, event.recipient_user_id)
        approveUrl = urls.approveUrl
        dismissUrl = urls.dismissUrl
      }

      if (event.event_type === 'integration_disconnected' && event.recipient_user_id) {
        const meta = event.delivery_status as Record<string, string>
        reconnectUrl = await integrationReconnectUrl(meta.source ?? '', event.recipient_user_id)
      }

      // Fetch finding/action details for the email body
      let extra: Record<string, unknown> = {
        approveUrl,
        dismissUrl,
        reconnectUrl,
      }

      if (event.source_type === 'finding' && event.source_id) {
        const { data: finding } = await supabase
          .from('us_findings')
          .select('severity, summary, account_value')
          .eq('id', event.source_id)
          .maybeSingle()
        if (finding) {
          extra = {
            ...extra,
            severity: finding.severity,
            summary: finding.summary,
            accountArr: finding.account_value ? '$' + Number(finding.account_value).toLocaleString() : '—',
          }
        }
      }

      if (event.source_type === 'action' && event.source_id) {
        const { data: action } = await supabase
          .from('us_actions')
          .select('composio_toolkit, composio_action, result_detail')
          .eq('id', event.source_id)
          .maybeSingle()
        if (action) {
          extra = {
            ...extra,
            toolkit: action.composio_toolkit,
            composioAction: action.composio_action,
            errorDetail: JSON.stringify(action.result_detail ?? 'Unknown error'),
          }
        }
      }

      // Construct escalation dispatch payload
      const escalationPayload: DispatchPayload = {
        event_type: 'finding_escalation',
        source_type: event.source_type,
        source_id: event.source_id,
        client_id: event.client_id,
        recipient_user_id: event.recipient_user_id,
        recipient_email: event.recipient_email,
        severity: extra.severity as 'P0' | 'P1' | 'P2' | 'P3' | undefined,
        metadata: extra,
      }

      // Send escalation email directly (bypass dispatch to avoid re-logging a new event)
      const emailStatus = await sendEmailForEvent(escalationPayload, extra)

      // Mark original event as escalated
      await supabase
        .from('us_notification_events')
        .update({ escalation_sent_at: new Date().toISOString() })
        .eq('id', event.id)

      results.push({ id: event.id, status: emailStatus })
    } catch (err) {
      console.error('[escalation] failed for event', event.id, err)
      results.push({ id: event.id, status: 'error' })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
