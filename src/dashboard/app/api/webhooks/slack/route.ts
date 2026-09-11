/**
 * POST /api/webhooks/slack: Slack Interactivity (block_actions)
 *
 * Slack sends this when a user clicks a button in an interactive message.
 *   - us_approve_action:{actionId}  -> approve + execute
 *   - us_dismiss_action:{actionId}  -> dismiss
 *
 * Security: Slack signs every request with HMAC-SHA256 (SLACK_SIGNING_SECRET).
 * FAIL CLOSED: without a configured secret, no Slack-driven approvals are possible.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { approveAction, dismissAction } from '@/services/approval'
import { ACTION_STATUSES } from '@/types/constants'
import { getStrongSecret } from '@/lib/secrets'

export const dynamic = 'force-dynamic'

function verifySlackSignature(body: string, timestamp: string | null, signature: string | null): boolean {
  const secret = getStrongSecret('SLACK_SIGNING_SECRET')
  if (!secret || !timestamp || !signature) return false

  const tsNumber = parseInt(timestamp, 10)
  if (!Number.isFinite(tsNumber) || Math.abs(Date.now() / 1000 - tsNumber) > 300) return false

  const sigBase = `v0:${timestamp}:${body}`
  const expected = 'v0=' + crypto.createHmac('sha256', secret).update(sigBase).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp')
  const signature = req.headers.get('x-slack-signature')

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const formData = new URLSearchParams(rawBody)
  const payloadRaw = formData.get('payload')
  if (!payloadRaw) return NextResponse.json({ error: 'Missing payload' }, { status: 400 })

  let payload: {
    type: string
    actions?: Array<{ action_id: string; value?: string }>
    user?: { id: string; name?: string; profile?: { email?: string } }
    response_url?: string
  }
  try {
    payload = JSON.parse(payloadRaw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (payload.type !== 'block_actions') return NextResponse.json({ ok: true })

  const action = payload.actions?.[0]
  if (!action) return NextResponse.json({ ok: true })

  const slackUserId = payload.user?.id ?? 'slack_user'
  const slackEmail = payload.user?.profile?.email ?? slackUserId

  const approveMatch = action.action_id.match(/^us_approve_action:([a-f0-9-]{36})$/)
  const dismissMatch = action.action_id.match(/^us_dismiss_action:([a-f0-9-]{36})$/)
  if (!approveMatch && !dismissMatch) return NextResponse.json({ ok: true })

  const actionId = (approveMatch ?? dismissMatch)![1]

  const db = createServiceClient()
  const { data: actionRow } = await db
    .from('us_actions')
    .select('id, status')
    .eq('id', actionId)
    .maybeSingle()

  if (!actionRow) {
    await respondToSlack(payload.response_url, 'Action not found.')
    return NextResponse.json({ ok: true })
  }
  if (actionRow.status !== ACTION_STATUSES.APPROVE_REQUIRED) {
    await respondToSlack(payload.response_url, `Action has already been processed (current status: ${actionRow.status}).`)
    return NextResponse.json({ ok: true })
  }

  if (approveMatch) {
    const result = await approveAction({ actionId, approvedByEmail: slackEmail })
    await respondToSlack(payload.response_url, result.success
      ? `Action approved and executed by <@${slackUserId}>.`
      : `Approval failed: ${result.error}`)
  } else {
    await dismissAction({ actionId, dismissedByEmail: slackEmail, reason: 'Dismissed via Slack' })
    await respondToSlack(payload.response_url, `Action dismissed by <@${slackUserId}>.`)
  }

  return NextResponse.json({ ok: true })
}

async function respondToSlack(responseUrl: string | undefined, text: string): Promise<void> {
  if (!responseUrl || !responseUrl.startsWith('https://hooks.slack.com/')) return
  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, replace_original: true }),
    })
  } catch (err) {
    console.error('[webhook/slack] Failed to send response_url update:', err)
  }
}
