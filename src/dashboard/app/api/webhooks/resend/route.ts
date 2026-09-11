import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


/**
 * Resend event webhook (svix-signed): logs sent / delivered / opened / clicked /
 * bounced / complained into email_events, powering the deliverability targets
 * (delivery >98%, bounce <2%, complaint <0.1%). Configure the endpoint + secret
 * in the Resend dashboard; set RESEND_WEBHOOK_SECRET in the environment.
 * FAIL CLOSED: no secret configured means no events are accepted.
 */
async function verifySvix(
  secret: string,
  id: string | null,
  timestamp: string | null,
  signature: string | null,
  payload: string
): Promise<boolean> {
  if (!id || !timestamp || !signature) return false
  // Reject stale timestamps (5 min tolerance) to prevent replay.
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false
  
  // Base64 decode the secret to raw bytes using atob and Uint8Array
  const b64Secret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const binaryString = atob(b64Secret)
  const keyBytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    keyBytes[i] = binaryString.charCodeAt(i)
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const encoder = new TextEncoder()
  const data = encoder.encode(`${id}.${timestamp}.${payload}`)
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data)
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  // svix sends space-separated versioned signatures: "v1,<base64> v1,<base64>"
  return signature.split(' ').some((part) => {
    const sig = part.includes(',') ? part.split(',')[1] : part
    return sig === expected;
  })
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 503 })

  const payload = await request.text()
  const valid = await verifySvix(
    secret,
    request.headers.get('svix-id'),
    request.headers.get('svix-timestamp'),
    request.headers.get('svix-signature'),
    payload
  )
  if (!valid) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })

  let event: { type?: string; data?: { email_id?: string; to?: string | string[]; subject?: string } }
  try {
    event = JSON.parse(payload)
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  try {
    const db = createServiceClient()
    const type = event.type ?? 'unknown'
    const recipient = Array.isArray(event.data?.to) ? (event.data?.to[0] ?? null) : (event.data?.to ?? null)
    await db.from('email_events').insert({
      email_id: event.data?.email_id ?? null,
      event_type: type,
      recipient,
      subject: event.data?.subject ?? null,
    })

    // Advance review-request funnel on open/click (Feature 1). Cumulative + monotonic:
    // never downgrade a further-along status. Matches the most recent 'sent' request to
    // this recipient by email.
    const stage = type.includes('clicked') ? 'clicked' : type.includes('opened') ? 'opened' : null
    if (stage && recipient) {
      const priorOk = stage === 'clicked' ? ['sent', 'opened'] : ['sent']
      const { data: reqRow } = await db
        .from('review_requests')
        .select('id')
        .eq('recipient_email', String(recipient).toLowerCase())
        .in('status', priorOk)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (reqRow) await db.from('review_requests').update({ status: stage }).eq('id', reqRow.id)
    }
  } catch (err) {
    // Log-and-acknowledge: a storage hiccup must not make Resend retry-storm us.
    console.error('[resend-webhook] insert failed:', err)
  }
  return NextResponse.json({ ok: true })
}
