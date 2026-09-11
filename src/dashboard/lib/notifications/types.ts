/**
 * UserSessions.io Notification System — Type Definitions
 *
 * NotificationEvent is the atomic unit: one row per (event_type, source_id, recipient).
 * Mirrors the us_notification_events DB table exactly.
 */

export type NotifChannel = 'slack' | 'email' | 'inapp'

export type NotifDeliveryStatus = 'sent' | 'skipped' | 'failed' | 'pending'

export type NotifEventType =
  | 'finding_pending_approval'
  | 'finding_escalation'
  | 'action_failed'
  | 'action_auto_executed'
  | 'integration_disconnected'
  | 'integration_connected'
  | 'payment_failed'
  | 'usage_threshold_80'
  | 'usage_threshold_100'
  | 'monthly_invoice'
  | 'policy_autonomy_increased'
  | 'team_member_added'
  | 'api_key_event'
  | 'new_login_unrecognized'
  | 'onboarding_welcome'
  | 'first_finding_detected'
  | 'daily_digest'
  | 'weekly_digest'
  | 'pilot_checkin'
  | 'mbr_generated'
  | 'renewal_reminder'

export type NotifSourceType =
  | 'finding'
  | 'action'
  | 'integration'
  | 'billing'
  | 'policy'
  | 'team'
  | 'auth'
  | 'system'

export interface NotificationEvent {
  id: string
  client_id: string | null
  event_type: NotifEventType
  source_type: NotifSourceType | null
  source_id: string | null
  recipient_user_id: string | null
  recipient_email: string
  channels_attempted: NotifChannel[]
  delivery_status: Record<NotifChannel, NotifDeliveryStatus>
  actioned_at: string | null
  actioned_channel: NotifChannel | null
  escalation_due_at: string | null
  escalation_sent_at: string | null
  idempotency_key: string
  created_at: string
}

/** Payload passed to the dispatch function for a new event */
export interface DispatchPayload {
  event_type: NotifEventType
  source_type: NotifSourceType
  source_id: string
  /** The client who owns the resource (finding / action / integration) */
  client_id: string
  /** User who should receive the notification */
  recipient_user_id: string
  recipient_email: string
  /** For finding events: the severity drives channel selection from user prefs */
  severity?: 'P0' | 'P1' | 'P2' | 'P3'
  /** Extra metadata for rendering the notification content */
  metadata: Record<string, unknown>
}

/** User notification preference columns (from profiles table) */
export interface NotifPrefs {
  notif_p0_channel: 'all' | 'email_only' | 'in_app_only'
  notif_p1_channel: 'all' | 'email_only' | 'in_app_only'
  notif_p2_channel: 'all' | 'email_only' | 'in_app_only'
  notif_p3_channel: 'all' | 'email_only' | 'in_app_only'
  notif_weekly_digest: boolean
  notif_link_alerts: boolean
}

/** Escalation windows per severity (hours) */
export const ESCALATION_HOURS: Record<'P0' | 'P1' | 'P2' | 'P3', number> = {
  P0: 24,
  P1: 24,
  P2: 72,
  P3: 72,
}

/** Map event type → source type for clarity */
export const EVENT_SOURCE_MAP: Record<NotifEventType, NotifSourceType> = {
  finding_pending_approval:  'finding',
  finding_escalation:        'finding',
  action_failed:             'action',
  action_auto_executed:      'action',
  integration_disconnected:  'integration',
  integration_connected:     'integration',
  payment_failed:            'billing',
  usage_threshold_80:        'billing',
  usage_threshold_100:       'billing',
  monthly_invoice:           'billing',
  policy_autonomy_increased: 'policy',
  team_member_added:         'team',
  api_key_event:             'auth',
  new_login_unrecognized:    'auth',
  onboarding_welcome:        'system',
  first_finding_detected:    'finding',
  daily_digest:              'system',
  weekly_digest:             'system',
  pilot_checkin:             'system',
  mbr_generated:             'system',
  renewal_reminder:          'system',
}
