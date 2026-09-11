import { createServiceClient } from './supabase/server'

export type AlertKind = 'security_alert' | 'revenue_spike' | 'system_error' | 'adapter_failure' | 'user_report' | 'compliance_flag'
export type AlertSeverity = 'info' | 'warning' | 'critical'

/** Auto-dismiss windows: info 24h, warning 72h, critical never (null). */
export const AUTO_DISMISS_MS: Record<AlertSeverity, number | null> = {
  info: 864e5,
  warning: 3 * 864e5,
  critical: null,
}

/** Write an admin alert. Call from crons, webhooks, and error paths. */
export async function createAdminAlert(
  kind: AlertKind,
  severity: AlertSeverity,
  title: string,
  body?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = createServiceClient()
  await db.from('admin_notifications').insert({ kind, severity, title, body: body ?? null, metadata: metadata ?? null })
}
