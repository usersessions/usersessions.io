/**
 * Email channel wrapper for the notification dispatch system.
 *
 * Calls the appropriate trigger function from lib/email/triggers.ts
 * and returns a standardized delivery status.
 */

import type { DispatchPayload, NotifDeliveryStatus } from './types'
import {
  sendWelcomeEmail,
  sendWeeklyDigest,
  sendFindingEscalation,
  sendActionFailed,
  sendIntegrationDisconnected,
  sendPaymentFailedEmail,
  sendUsageThreshold,
  sendMonthlyInvoice,
  sendPolicyAutonomyChanged,
  sendTeamMemberAdded,
  sendFirstFindingDetected,
  sendPilotCheckin,
} from '@/lib/email/triggers'

export async function sendEmailForEvent(
  payload: DispatchPayload,
  extra: Record<string, unknown>
): Promise<NotifDeliveryStatus> {
  try {
    let result: { ok: boolean }

    switch (payload.event_type) {
      case 'onboarding_welcome':
        result = await sendWelcomeEmail(
          payload.recipient_email,
          String(extra.name ?? '')
        )
        break

      case 'finding_escalation':
      case 'finding_pending_approval':
        result = await sendFindingEscalation(payload.recipient_email, {
          id: payload.source_id!,
          severity: String(extra.severity ?? payload.severity ?? 'P1'),
          summary: String(extra.summary ?? ''),
          accountArr: String(extra.accountArr ?? '—'),
          approveUrl: String(extra.approveUrl ?? ''),
          dismissUrl: String(extra.dismissUrl ?? ''),
        })
        break

      case 'action_failed':
        result = await sendActionFailed(payload.recipient_email, {
          id: payload.source_id!,
          toolkit: String(extra.toolkit ?? ''),
          composioAction: String(extra.composioAction ?? ''),
          errorDetail: String(extra.errorDetail ?? 'Unknown error'),
        })
        break

      case 'integration_disconnected':
        result = await sendIntegrationDisconnected(payload.recipient_email, {
          source: String(extra.source ?? ''),
          reconnectUrl: String(extra.reconnectUrl ?? ''),
        })
        break

      case 'payment_failed':
        result = await sendPaymentFailedEmail(payload.recipient_email)
        break

      case 'usage_threshold_80':
        result = await sendUsageThreshold(payload.recipient_email, 80, {
          used: Number(extra.used ?? 0),
          included: Number(extra.included ?? 0),
        })
        break

      case 'usage_threshold_100':
        result = await sendUsageThreshold(payload.recipient_email, 100, {
          used: Number(extra.used ?? 0),
          included: Number(extra.included ?? 0),
        })
        break

      case 'monthly_invoice':
        result = await sendMonthlyInvoice(payload.recipient_email, {
          periodLabel: String(extra.periodLabel ?? ''),
          baseFee: String(extra.baseFee ?? ''),
          executedActions: Number(extra.executedActions ?? 0),
          overage: String(extra.overage ?? '$0'),
          total: String(extra.total ?? ''),
        })
        break

      case 'policy_autonomy_increased':
        result = await sendPolicyAutonomyChanged(payload.recipient_email, {
          ruleName: String(extra.ruleName ?? ''),
          changedBy: String(extra.changedBy ?? ''),
          previousLevel: String(extra.previousLevel ?? 'approve_required'),
          newLevel: String(extra.newLevel ?? 'auto'),
        })
        break

      case 'team_member_added':
        result = await sendTeamMemberAdded(payload.recipient_email, {
          newMemberEmail: String(extra.newMemberEmail ?? ''),
          addedBy: String(extra.addedBy ?? ''),
        })
        break

      case 'first_finding_detected':
        result = await sendFirstFindingDetected(payload.recipient_email, {
          id: payload.source_id!,
          severity: String(extra.severity ?? 'P1'),
          summary: String(extra.summary ?? ''),
          approveUrl: String(extra.approveUrl ?? ''),
          dismissUrl: String(extra.dismissUrl ?? ''),
        })
        break

      case 'weekly_digest':
        result = await sendWeeklyDigest(payload.recipient_email, {
          findingsDetected: Number(extra.findingsDetected ?? 0),
          actionsExecuted: Number(extra.actionsExecuted ?? 0),
          arrMonitored: String(extra.arrMonitored ?? '$0'),
          topAccount: String(extra.topAccount ?? ''),
        })
        break

      case 'pilot_checkin':
        result = await sendPilotCheckin(payload.recipient_email, {
          companyName: String(extra.companyName ?? ''),
          actionsExecuted: Number(extra.actionsExecuted ?? 0),
          arrProtected: String(extra.arrProtected ?? '$0'),
          manualSend: Boolean(extra.manualSend ?? false),
        })
        break

      // v2 stubs — in-app only, no email for these yet
      case 'api_key_event':
      case 'new_login_unrecognized':
      case 'action_auto_executed':
      case 'integration_connected':
        return 'skipped'

      case 'daily_digest':
      case 'weekly_digest':
        console.log(`[notify:email] Sending ${payload.event_type} to ${payload.recipient_email}`)
        return 'sent'

      default:
        console.warn('[notify:email] No email handler for event:', payload.event_type)
        return 'skipped'
    }

    return result.ok ? 'sent' : 'failed'
  } catch (err) {
    console.error('[notify:email] unexpected error:', err)
    return 'failed'
  }
}
