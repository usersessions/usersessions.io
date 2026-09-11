/**
 * Notification dispatch orchestrator.
 *
 * Given a DispatchPayload:
 * 1. Check recipient's notification prefs for this severity
 * 2. Check idempotency key — skip if already sent
 * 3. Determine channels per the event×channel matrix
 * 4. Fire each channel, collect delivery status
 * 5. Log to us_notification_events
 * 6. Set escalation_due_at if event is actionable
 */

import { createServiceClient } from '@/lib/supabase/server'
import type {
  DispatchPayload,
  NotifChannel,
  NotifDeliveryStatus,
  NotifPrefs,
} from './types'
import { ESCALATION_HOURS } from './types'
import { sendInAppNotification } from './channel-inapp'
import { sendEmailForEvent } from './channel-email'
import {
  sendSlackFindingApproval,
  sendSlackActionFailed,
  sendSlackIntegrationDisconnected,
} from './channel-slack'
import {
  findingActionUrls,
  integrationReconnectUrl,
} from './signed-actions'

// ── Idempotency key ───────────────────────────────────────────
function makeIdempotencyKey(payload: DispatchPayload): string {
  return `${payload.event_type}:${payload.source_id ?? 'system'}:${payload.recipient_email}`
}

// ── Per-severity channel resolution ──────────────────────────
function resolveChannels(
  payload: DispatchPayload,
  prefs: NotifPrefs | null
): NotifChannel[] {
  const sev = payload.severity
  const prefKey = sev ? (`notif_${sev.toLowerCase()}_channel` as keyof NotifPrefs) : null
  const prefVal = prefKey && prefs ? (prefs[prefKey] as string) : 'all'

  // Events that are always in-app only (no interruption)
  const inAppOnly = new Set([
    'action_auto_executed',
    'api_key_event',
    'new_login_unrecognized',
  ])
  if (inAppOnly.has(payload.event_type)) return ['inapp']

  // Billing/security events always go to email + inapp
  const emailEvents = new Set([
    'payment_failed',
    'usage_threshold_80',
    'usage_threshold_100',
    'monthly_invoice',
    'integration_connected',
    'policy_autonomy_increased',
    'team_member_added',
    'daily_digest',
    'weekly_digest',
    'pilot_checkin',
    'onboarding_welcome',
  ])
  if (emailEvents.has(payload.event_type)) return ['email', 'inapp']

  // Finding + action events: respect user pref
  if (prefVal === 'in_app_only') return ['inapp']
  if (prefVal === 'email_only')  return ['email', 'inapp']
  return ['slack', 'email', 'inapp'] // 'all' default
}

// ── Main dispatch function ────────────────────────────────────

export async function dispatch(
  payload: DispatchPayload,
  extra: Record<string, unknown> = {}
): Promise<void> {
  // Service role: dispatch runs from crons and webhooks where there is no user session.
  // With the RLS client those calls saw no prefs and could never write the event log.
  const supabase = createServiceClient()
  const idempotencyKey = makeIdempotencyKey(payload)

  // 1. Idempotency check
  const { data: existing } = await supabase
    .from('us_notification_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) {
    console.log('[notify:dispatch] already sent, skipping:', idempotencyKey)
    return
  }

  // 2. Load recipient notification prefs
  const { data: profile } = await supabase
    .from('profiles')
    .select('notif_p0_channel, notif_p1_channel, notif_p2_channel, notif_p3_channel, notif_weekly_digest, notif_link_alerts')
    .eq('id', payload.recipient_user_id)
    .maybeSingle()

  const prefs = profile as NotifPrefs | null

  // 3. Resolve channels
  const channels = resolveChannels(payload, prefs)

  // 4. Build signed action URLs if needed
  let approveUrl: string | undefined
  let dismissUrl: string | undefined
  let reconnectUrl: string | undefined

  const isFindingEvent = ['finding_pending_approval', 'finding_escalation', 'first_finding_detected'].includes(payload.event_type)
  const isIntegrationEvent = payload.event_type === 'integration_disconnected'

  // Signed one-click URLs require NOTIFY_ACTION_SECRET; without it fall back to
  // plain dashboard links rather than failing the whole notification.
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://usersessions.io'
  if (isFindingEvent && payload.source_id) {
    try {
      const urls = await findingActionUrls(payload.source_id, payload.recipient_user_id!)
      approveUrl = urls.approveUrl
      dismissUrl = urls.dismissUrl
    } catch (err: any) {
      console.warn('[notify:dispatch] could not sign action URLs, using dashboard links:', err?.message ?? err)
      approveUrl = `${site}/approvals?finding=${encodeURIComponent(payload.source_id)}`
      dismissUrl = approveUrl
    }
  }
  if (isIntegrationEvent) {
    try {
      reconnectUrl = await integrationReconnectUrl(String(extra.source ?? ''), payload.recipient_user_id!)
    } catch {
      reconnectUrl = `${site}/connect`
    }
  }

  const enrichedExtra = { ...extra, approveUrl, dismissUrl, reconnectUrl }

  // 5. Fire each channel
  const deliveryStatus: Record<string, NotifDeliveryStatus> = {}

  for (const channel of channels) {
    if (channel === 'inapp') {
      const title = String(extra.title ?? payload.event_type)
      const body  = String(extra.body  ?? '')
      const link  = String(extra.link  ?? '')
      deliveryStatus.inapp = await sendInAppNotification(payload, title, body, link || undefined)
    }

    if (channel === 'email') {
      deliveryStatus.email = await sendEmailForEvent(payload, enrichedExtra)
    }

    if (channel === 'slack') {
      // Load client for Slack config
      const { data: client } = await supabase
        .from('us_clients')
        .select('composio_entity_id, slack_alert_channel, connected_composio_apps')
        .eq('id', payload.client_id)
        .maybeSingle()

      const hasSlack = client?.connected_composio_apps?.includes('slack')
      const entityId = client?.composio_entity_id
      const slackChannel = client?.slack_alert_channel ?? '#general'

      if (!hasSlack || !entityId) {
        deliveryStatus.slack = 'skipped'
      } else if (isFindingEvent) {
        deliveryStatus.slack = await sendSlackFindingApproval({
          entityId,
          channel: slackChannel,
          severity: String(extra.severity ?? payload.severity ?? 'P1'),
          summary: String(extra.summary ?? ''),
          accountArr: extra.accountArr ? String(extra.accountArr) : undefined,
          approveUrl: approveUrl!,
          dismissUrl: dismissUrl!,
          findingId: payload.source_id!,
        })
      } else if (payload.event_type === 'action_failed') {
        deliveryStatus.slack = await sendSlackActionFailed({
          entityId,
          channel: slackChannel,
          toolkit: String(extra.toolkit ?? ''),
          composioAction: String(extra.composioAction ?? ''),
          errorDetail: String(extra.errorDetail ?? ''),
          actionId: payload.source_id!,
        })
      } else if (isIntegrationEvent) {
        deliveryStatus.slack = await sendSlackIntegrationDisconnected({
          entityId,
          channel: slackChannel,
          source: String(extra.source ?? ''),
          reconnectUrl: reconnectUrl!,
        })
      } else {
        deliveryStatus.slack = 'skipped'
      }

      // If Slack failed, fall back to email
      if (deliveryStatus.slack === 'failed' && !deliveryStatus.email) {
        deliveryStatus.email = await sendEmailForEvent(payload, enrichedExtra)
      }
    }
  }

  // 6. Calculate escalation window (for actionable finding/action events)
  let escalationDueAt: string | null = null
  const isActionable = isFindingEvent || payload.event_type === 'action_failed'
  if (isActionable && payload.severity) {
    const hours = ESCALATION_HOURS[payload.severity] ?? 72
    escalationDueAt = new Date(Date.now() + hours * 3600 * 1000).toISOString()
  }

  // 7. Log to us_notification_events
  const { error } = await supabase.from('us_notification_events').insert({
    client_id: payload.client_id,
    event_type: payload.event_type,
    source_type: payload.source_type,
    source_id: payload.source_id,
    recipient_user_id: payload.recipient_user_id,
    recipient_email: payload.recipient_email,
    channels_attempted: channels,
    delivery_status: deliveryStatus,
    escalation_due_at: escalationDueAt,
    idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error('[notify:dispatch] failed to log notification event:', error.message)
  }
}
