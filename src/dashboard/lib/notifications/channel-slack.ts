/**
 * Slack notification channel.
 *
 * Posts Block Kit messages with inline Approve / Dismiss / Edit buttons
 * via Composio's Slack toolkit. This is the PRIMARY channel for anything
 * that needs a decision — Slack carries the action, not the dashboard.
 *
 * Falls back to the client's slack_alert_channel if no direct channel is specified.
 * Falls back to in-app-only if Slack is not connected.
 */

import type { DispatchPayload, NotifDeliveryStatus } from './types'

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v1'

interface SlackBlock {
  type: string
  [key: string]: unknown
}

interface SlackMessage {
  channel: string
  blocks: SlackBlock[]
  text: string // fallback plain text for notifications
}

/**
 * Post a Slack message via Composio's Slack toolkit.
 * Uses the client's composio_entity_id for auth context.
 */
async function postViaComposio(
  entityId: string,
  message: SlackMessage
): Promise<{ ok: boolean; error?: string }> {
  if (!COMPOSIO_API_KEY) {
    console.warn('[notify:slack] COMPOSIO_API_KEY not set')
    return { ok: false, error: 'no_api_key' }
  }
  try {
    const res = await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/SLACK_SEND_MESSAGE`, {
      method: 'POST',
      headers: {
        'x-api-key': COMPOSIO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: entityId,
        arguments: {
          channel: message.channel.replace(/^#/, ''),
          fallback_text: message.text,
          blocks: message.blocks,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[notify:slack] Composio error:', res.status, data)
      return { ok: false, error: String(data?.message ?? res.status) }
    }
    return { ok: true }
  } catch (err) {
    console.error('[notify:slack] unexpected error:', err)
    return { ok: false, error: String(err) }
  }
}

/** Build Block Kit for a finding-approval message */
function buildFindingApprovalBlocks(opts: {
  severity: string
  summary: string
  accountArr?: string
  approveUrl: string
  dismissUrl: string
  dashboardUrl: string
}): SlackBlock[] {
  const sevColor: Record<string, string> = { P0: '#E53E3E', P1: '#DD6B20', P2: '#D69E2E', P3: '#3182CE' }
  const color = sevColor[opts.severity] ?? '#718096'

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:rotating_light: ${opts.severity} Finding — Approval Required*\n${opts.summary}`,
      },
    },
    ...(opts.accountArr ? [{
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `ARR at risk: *${opts.accountArr}*` }],
    }] : []),
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Approve', emoji: true },
          style: 'primary',
          url: opts.approveUrl,
          action_id: 'approve_finding',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '✗ Dismiss', emoji: true },
          style: 'danger',
          url: opts.dismissUrl,
          action_id: 'dismiss_finding',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in dashboard →', emoji: true },
          url: opts.dashboardUrl,
          action_id: 'view_dashboard',
        },
      ],
    },
  ]
}

/** Build Block Kit for an action-failed message */
function buildActionFailedBlocks(opts: {
  toolkit: string
  composioAction: string
  errorDetail: string
  dashboardUrl: string
}): SlackBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:x: Action Failed — ${opts.toolkit}*\nCould not execute \`${opts.composioAction}\``,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Error:* ${opts.errorDetail}` },
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Retry in dashboard →', emoji: true },
          url: opts.dashboardUrl,
          action_id: 'view_failed_action',
        },
      ],
    },
  ]
}

/** Build Block Kit for integration disconnected */
function buildIntegrationDisconnectedBlocks(opts: {
  source: string
  reconnectUrl: string
}): SlackBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*:warning: Integration Disconnected — ${opts.source}*\nSession monitoring has paused for this source. Every session missed while disconnected is invisible to the whole pipeline.`,
      },
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔗 Reconnect now', emoji: true },
          style: 'primary',
          url: opts.reconnectUrl,
          action_id: 'reconnect_integration',
        },
      ],
    },
  ]
}

// ─── Public API ───────────────────────────────────────────────

export interface SlackFindingPayload {
  entityId: string
  channel: string
  severity: string
  summary: string
  accountArr?: string
  approveUrl: string
  dismissUrl: string
  findingId: string
}

export async function sendSlackFindingApproval(p: SlackFindingPayload): Promise<NotifDeliveryStatus> {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'
  const blocks = buildFindingApprovalBlocks({
    severity: p.severity,
    summary: p.summary,
    accountArr: p.accountArr,
    approveUrl: p.approveUrl,
    dismissUrl: p.dismissUrl,
    dashboardUrl: `${SITE}/?finding=${p.findingId}`,
  })
  const result = await postViaComposio(p.entityId, {
    channel: p.channel,
    text: `[${p.severity}] Finding awaiting approval: ${p.summary}`,
    blocks,
  })
  return result.ok ? 'sent' : 'failed'
}

export interface SlackActionFailedPayload {
  entityId: string
  channel: string
  toolkit: string
  composioAction: string
  errorDetail: string
  actionId: string
}

export async function sendSlackActionFailed(p: SlackActionFailedPayload): Promise<NotifDeliveryStatus> {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'
  const blocks = buildActionFailedBlocks({
    toolkit: p.toolkit,
    composioAction: p.composioAction,
    errorDetail: p.errorDetail,
    dashboardUrl: `${SITE}/audit?action=${p.actionId}`,
  })
  const result = await postViaComposio(p.entityId, {
    channel: p.channel,
    text: `Action failed: ${p.toolkit} / ${p.composioAction}`,
    blocks,
  })
  return result.ok ? 'sent' : 'failed'
}

export interface SlackIntegrationDisconnectedPayload {
  entityId: string
  channel: string
  source: string
  reconnectUrl: string
}

export async function sendSlackIntegrationDisconnected(p: SlackIntegrationDisconnectedPayload): Promise<NotifDeliveryStatus> {
  const blocks = buildIntegrationDisconnectedBlocks({ source: p.source, reconnectUrl: p.reconnectUrl })
  const result = await postViaComposio(p.entityId, {
    channel: p.channel,
    text: `Integration disconnected: ${p.source} — monitoring paused`,
    blocks,
  })
  return result.ok ? 'sent' : 'failed'
}
