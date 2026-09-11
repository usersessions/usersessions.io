import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { ACTION_STATUSES } from '@/types/constants'
import { getStrongSecret } from '@/lib/secrets'

export const dynamic = 'force-dynamic'

// Composio signs every webhook with HMAC-SHA256 using the signing secret from the
// Composio dashboard (Webhooks -> Signing secret). Set COMPOSIO_WEBHOOK_SECRET.
function verifyComposioSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'))
  } catch {
    return false
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/**
 * POST /api/webhooks/composio
 *
 * Handled events:
 *   composio.connected_account.expired  -> drop the app from the client's connected list, notify
 *   composio.action.completed / execution_completed -> finalize an action we marked `executing`
 *
 * Everything else is acknowledged and logged. Processing happens before the response
 * because background work after the response is not guaranteed on Workers.
 * FAIL CLOSED: no signing secret configured means every call is rejected.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const secret = getStrongSecret('COMPOSIO_WEBHOOK_SECRET')
  const sig = req.headers.get('x-composio-signature') ?? req.headers.get('x-webhook-signature')
  if (!secret || !verifyComposioSignature(rawBody, sig, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: Record<string, any>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventType: string = str(event?.type) || str(event?.event)
  const data = (event?.data ?? {}) as Record<string, any>
  const entityId = str(data.entityId) || str(data.entity_id) || str(data.user_id)

  try {
    const db = createServiceClient()

    if (eventType === 'composio.connected_account.expired') {
      const appName = (str(data.appName) || str(data.app_name) || str(data.toolkit?.slug)).toLowerCase()
      const connectedAccountId = str(data.connectedAccountId) || str(data.connected_account_id) || str(data.id)

      if (entityId) {
        const { data: client } = await db
          .from('us_clients')
          .select('id, connected_composio_apps, composio_connected_accounts')
          .eq('composio_entity_id', entityId)
          .maybeSingle()

        if (client) {
          const apps = ((client.connected_composio_apps as string[]) ?? []).filter((a) => a.toLowerCase() !== appName)
          const accounts = { ...((client.composio_connected_accounts as Record<string, string>) ?? {}) }
          if (appName) delete accounts[appName]

          await db.from('us_clients')
            .update({ connected_composio_apps: apps, composio_connected_accounts: accounts })
            .eq('id', client.id)

          await db.from('us_notification_events').insert({
            client_id: client.id,
            event_type: 'integration_disconnected',
            payload: { app: appName, connected_account_id: connectedAccountId, reason: 'expired' },
          })
        }
      }
      return NextResponse.json({ received: true })
    }

    if (eventType === 'composio.action.completed' || eventType === 'execution_completed') {
      const actionId = str(data.client_reference_id) || str(data.action_id)
      const status = str(data.status) || 'success'
      const success = status === 'success' || status === 'COMPLETED' || data.successful === true

      if (actionId) {
        // Only finalize actions we are actually waiting on; never flip a failed/dismissed row.
        await db
          .from('us_actions')
          .update({
            status: success ? ACTION_STATUSES.EXECUTED : ACTION_STATUSES.FAILED,
            result: success ? 'success' : 'failed',
            result_detail: data.result ?? data,
            executed_at: success ? new Date().toISOString() : null,
            last_error: success ? null : str(data.error) || 'reported failed by Composio',
          })
          .eq('id', actionId)
          .eq('status', ACTION_STATUSES.EXECUTING)
      }
      return NextResponse.json({ received: true })
    }

    console.log(`[Composio Webhook] Unhandled event type "${eventType}" for entity ${entityId || 'unknown'}`)
    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[Composio Webhook] processing error:', err?.message ?? err)
    return NextResponse.json({ received: true, processed: false })
  }
}
