/**
 * Approval workflow (Build Spec §9)
 *
 * For actions routed to approve_required:
 *   1. Post an interactive Slack alert to the client's configured channel.
 *      The message includes a deep-link to the web audit log for approve/dismiss.
 *   2. The web audit log (/audit) provides the actual approve/dismiss buttons.
 *
 * Full Slack interactive components (block_actions callbacks) would require a
 * dedicated Slack App with a request URL pointing at /api/webhooks/slack.
 * That's Phase 2 hardening — for MVP the approval is web-UI-first.
 * The Slack message contains a working deep-link to the right audit row.
 *
 * Dismissal and editing are also logged — that data tunes the policy engine
 * over time (Build Spec §9: "this data is valuable").
 */

import { executeComposioAction } from '@/lib/actions/composio-client'
import { createServiceClient } from '@/lib/supabase/server'
import type { USClient, USFinding, USAction, ReasoningOutput } from '@/types/usersessions'
import { ACTION_STATUSES, FINDING_STATUSES } from '@/types/constants'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'

// ── Slack message builder ─────────────────────────────────────

function buildApprovalMessage(params: {
  finding: ReasoningOutput | USFinding
  action: USAction
  replayUrl: string | null
  auditUrl: string
}): Record<string, unknown> {
  const { finding, action, replayUrl, auditUrl } = params
  const severityEmoji: Record<string, string> = {
    P0: '🚨', P1: '🔴', P2: '🟡', P3: '⚪',
  }
  const cat = 'category' in finding ? finding.category : (finding as any).category
  const sev = 'severity' in finding ? finding.severity : (finding as any).severity
  const summary = 'summary' in finding ? finding.summary : (finding as any).summary

  const emoji = severityEmoji[sev] ?? '🔵'
  const replayLine = replayUrl ? `\n🔗 *Replay:* ${replayUrl}` : ''

  return {
    channel: '',          // caller injects channel
    text: `${emoji} *UserSessions.io — Action Awaiting Approval*`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} [${sev}] Action Required`, emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Finding:* ${summary}\n*Category:* ${cat} | *Severity:* ${sev}\n*Proposed action:* \`${action.composio_toolkit}/${action.composio_action}\`${replayLine}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Approve', emoji: true },
            style: 'primary',
            action_id: `us_approve_action:${action.id}`,
            value: 'approve',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Dismiss', emoji: true },
            style: 'danger',
            action_id: `us_dismiss_action:${action.id}`,
            value: 'dismiss',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `_Action ID: ${action.id} · <${SITE_URL}/audit|Open Audit Log>_`,
          },
        ],
      },
    ],
  }
}

// ── Post approval request ─────────────────────────────────────

/**
 * Posts an approval request to the client's configured Slack channel.
 * Called immediately after an approve_required Action row is created.
 */
export async function postApprovalRequest(params: {
  client: USClient
  finding: USFinding | ReasoningOutput
  action: USAction
  replayUrl: string | null
}): Promise<void> {
  const { client, finding, action, replayUrl } = params

  if (!client.composio_entity_id || !client.slack_alert_channel) {
    console.warn('[approval] Skipping Slack approval post — no entity_id or slack_alert_channel configured')
    return
  }

  const auditUrl = `${SITE_URL}/audit?action_id=${action.id}`
  const message = buildApprovalMessage({ finding, action, replayUrl, auditUrl })
  message.channel = client.slack_alert_channel

  try {
    await executeComposioAction({
      entityId: client.composio_entity_id,
      toolkit: 'slack',
      actionName: 'SLACK_CHAT_POST_MESSAGE',
      actionParams: message,
    })
    console.log(`[approval] Posted approval request for action ${action.id} to ${client.slack_alert_channel}`)
  } catch (err: any) {
    // Non-fatal — approval can still happen via web UI
    console.warn(`[approval] Slack post failed for action ${action.id}:`, err.message)
  }
}

// ── Approve action ────────────────────────────────────────────

/**
 * Human approves an action. Triggers the Composio call immediately.
 * Returns the result of the execution.
 */
export async function approveAction(params: {
  actionId: string
  approvedByEmail: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()
  const { actionId, approvedByEmail } = params

  // Fetch the action and its finding + client
  const { data: action, error: fetchErr } = await supabase
    .from('us_actions')
    .select('*, us_findings(*, us_sessions(*)), us_clients(*)')
    .eq('id', actionId)
    .single()

  if (fetchErr || !action) {
    return { success: false, error: `Action ${actionId} not found` }
  }

  if (action.status !== ACTION_STATUSES.APPROVE_REQUIRED) {
    return { success: false, error: `Action ${actionId} is not in approve_required state (current: ${action.status})` }
  }

  // Import executor lazily to avoid circular dep
  const { executeAction } = await import('@/services/executor')

  const finding = action.us_findings as any
  const client = action.us_clients as any

  const result = await executeAction({
    findingId: finding.id,
    client,
    finding: {
      category: finding.category as any,
      severity: finding.severity as any,
      confidence: finding.confidence,
      summary: finding.summary,
      recommended_actions: [],
    },
    sessionContext: {
      source: finding.us_sessions!.source,
      source_session_id: finding.us_sessions!.source_session_id,
      replay_url: finding.us_sessions!.replay_url
    },
    accountId: finding.account_id,
    decision: {
      action: {
        toolkit: action.composio_toolkit,
        action: action.composio_action,
        params: action.params as Record<string, unknown>
      },
      autonomy_level: action.autonomy_level as any,
      reversible: action.reversible,
      matched_rule_id: null
    },
    approvedBy: approvedByEmail,
    existingActionId: actionId
  })

  return { success: result.result === 'success', error: result.error }
}

// ── Dismiss action ────────────────────────────────────────────

/**
 * Human dismisses an action. Logs the reason — valuable for policy tuning.
 */
export async function dismissAction(params: {
  actionId: string
  dismissedByEmail: string
  reason?: string
}): Promise<void> {
  const supabase = createServiceClient()
  const { actionId, dismissedByEmail, reason } = params

  await supabase
    .from('us_actions')
    .update({
      status: ACTION_STATUSES.DISMISSED,
      result_detail: { dismissed_by: dismissedByEmail, reason: reason ?? 'no reason given' },
    })
    .eq('id', actionId)
    .eq('status', ACTION_STATUSES.APPROVE_REQUIRED)  // only dismiss if it hasn't already been approved

  // Also update the parent Finding status to dismissed if ALL its actions are dismissed
  const { data: action } = await supabase
    .from('us_actions')
    .select('finding_id')
    .eq('id', actionId)
    .single()

  if (action?.finding_id) {
    const { data: siblingActions } = await supabase
      .from('us_actions')
      .select('status')
      .eq('finding_id', action.finding_id)

    const allDismissed = siblingActions?.every((a) => a.status === ACTION_STATUSES.DISMISSED) ?? false
    if (allDismissed) {
      await supabase
        .from('us_findings')
        .update({ status: FINDING_STATUSES.DISMISSED })
        .eq('id', action.finding_id)
    }
  }

  console.log(`[approval] Action ${actionId} dismissed by ${dismissedByEmail}: ${reason ?? 'no reason'}`)
}
