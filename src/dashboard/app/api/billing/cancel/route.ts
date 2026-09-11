import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { disableSubscription, findActiveSubscription } from '@/lib/billing/paystack'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'


/**
 * POST /api/billing/cancel — session-authenticated auto-renew cancellation.
 * Uses the paystack_email_token captured by the webhook (BUILD_SPEC §11).
 * SELF-HEALING: if the subscription.create webhook never stored the subscription
 * code / email token, they are recovered live from Paystack via the customer code.
 * Sets subscription_status='non_renewing'; plan access persists until period end
 * (the subscription.disable webhook downgrades the plan when Paystack confirms).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url), 303)

  const db = createServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('plan, paystack_customer_code, paystack_subscription_code, paystack_email_token')
    .eq('id', user.id)
    .single()

  if (!profile || profile.plan === 'free') {
    return NextResponse.redirect(new URL('/settings?cancel_error=1', request.url), 303)
  }

  let subCode: string | null = profile.paystack_subscription_code
  let emailToken: string | null = profile.paystack_email_token

  // Webhook missed subscription.create? Recover the codes straight from Paystack.
  if ((!subCode || !emailToken) && profile.paystack_customer_code) {
    const found = await findActiveSubscription(profile.paystack_customer_code)
    if (found) {
      subCode = found.subscriptionCode
      emailToken = found.emailToken
      await db
        .from('profiles')
        .update({ paystack_subscription_code: subCode, paystack_email_token: emailToken })
        .eq('id', user.id)
    }
  }

  if (!subCode || !emailToken) {
    return NextResponse.redirect(new URL('/settings?cancel_error=1', request.url), 303)
  }

  const ok = await disableSubscription(subCode, emailToken)
  if (!ok) return NextResponse.redirect(new URL('/settings?cancel_error=1', request.url), 303)

  await db.from('profiles').update({ subscription_status: 'non_renewing' }).eq('id', user.id)
  return NextResponse.redirect(new URL('/settings?cancelled=1', request.url), 303)
}
