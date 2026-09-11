import webpush from 'web-push'

/**
 * Web Push wrapper — fail-soft like lib/email: missing VAPID keys or a failed send
 * must never break a cron run or user-facing flow. Callers prune 'gone' subscriptions.
 */

export interface PushSubscriptionRow {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

let configured = false
function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:notifications@usersessions.io',
      publicKey,
      privateKey
    )
    configured = true
  }
  return true
}

export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload
): Promise<{ ok: boolean; gone: boolean }> {
  if (!configure()) {
    console.warn('[push] VAPID keys not set — push skipped')
    return { ok: false, gone: false }
  }
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    return { ok: true, gone: false }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const gone = statusCode === 404 || statusCode === 410 // subscription expired/unsubscribed
    if (!gone) console.error('[push] send failed:', statusCode ?? err)
    return { ok: false, gone }
  }
}
