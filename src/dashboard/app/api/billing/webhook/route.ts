import { NextResponse } from 'next/server'
import { disableSubscription, planIdFromCode, verifyWebhookSignature } from '@/lib/billing/paystack'
import { sendPaymentReceiptEmail, sendPaymentFailedEmail } from '@/lib/email/triggers'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePlanId, type PlanId } from '@/lib/tiers'
import { periodEndFrom } from '@/lib/billing/period'

// Force dynamic so Next.js never tries to statically collect this route at
// build time (Supabase URL is a runtime env var on Cloudflare, not a build var).
export const dynamic = 'force-dynamic'

/**
 * Plan state lives in two places: us_clients.plan_tier (pipeline, billing crons)
 * and profiles.plan / subscription_status (feature gates via getFeatureAccess).
 * Every transition must update both or paying customers never unlock features.
 */
async function applyPlan(
  db: ReturnType<typeof createServiceClient>,
  clientId: string,
  planTier: PlanId,
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'none',
) {
  await db.from('us_clients').update({ plan_tier: planTier }).eq('id', clientId)
  const { data: client } = await db.from('us_clients').select('profile_id').eq('id', clientId).maybeSingle()
  if (client?.profile_id) {
    await db.from('profiles').update({ plan: planTier, subscription_status: subscriptionStatus }).eq('id', client.profile_id)
  }
}

/**
 * Paystack webhook (BUILD_SPEC section 11): signature-verified (HMAC-SHA512 over the raw body),
 * handles charge.success, subscription.create, subscription.disable, invoice.payment_failed.
 * Stores email_token, required alongside subscription_code to cancel later.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })
  }

  let event: { event?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  const db = createServiceClient()
  const data = (event.data ?? {}) as {
    metadata?: { user_id?: string; client_id?: string }
    customer?: { customer_code?: string; email?: string }
    subscription_code?: string
    email_token?: string
    plan?: { plan_code?: string }
    subscription?: { subscription_code?: string }
    amount?: number
    currency?: string
    reference?: string
    next_payment_date?: string
    createdAt?: string
  }

  async function findClientId(): Promise<string | null> {
    if (data.metadata?.client_id) return data.metadata.client_id

    let userId: string | null = null
    if (data.metadata?.user_id) {
      userId = data.metadata.user_id
    } else if (data.customer?.email) {
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('email', data.customer.email)
        .maybeSingle()
      userId = profile?.id ?? null
    }

    if (userId) {
      const { data: client } = await db
        .from('us_clients')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle()
      return client?.id ?? null
    }
    return null
  }

  try {
    switch (event.event) {
      case 'charge.success': {
        const clientId = await findClientId()
        if (!clientId) break

        if (data.plan?.plan_code) {
          await db
            .from('us_subscriptions')
            .update({ status: 'active', plan_code: data.plan.plan_code })
            .eq('client_id', clientId)

          await applyPlan(db, clientId, normalizePlanId(planIdFromCode(data.plan.plan_code)), 'active')
        }

        if (data.customer?.email) {
          const amount = typeof data.amount === 'number' ? (data.amount / 100).toFixed(2) : null
          await sendPaymentReceiptEmail(
            data.customer.email,
            amount,
            String(data.currency ?? ''),
            data.plan?.plan_code ?? 'subscription',
            String(data.reference ?? '-'),
          )
        }
        break
      }

      case 'subscription.create': {
        const clientId = await findClientId()
        if (!clientId) break

        const start = typeof data.createdAt === 'string' && Number.isFinite(Date.parse(data.createdAt))
          ? new Date(Date.parse(data.createdAt)).toISOString()
          : new Date().toISOString()

        await db
          .from('us_subscriptions')
          .upsert({
            client_id: clientId,
            paystack_customer_code: data.customer?.customer_code ?? '',
            paystack_subscription_code: data.subscription_code ?? '',
            plan_code: data.plan?.plan_code ?? '',
            status: 'active',
            current_period_start: start,
            current_period_end: periodEndFrom(data.next_payment_date),
          }, { onConflict: 'client_id' })

        if (data.plan?.plan_code) {
          await applyPlan(db, clientId, normalizePlanId(planIdFromCode(data.plan.plan_code)), 'active')
        }
        break
      }

      case 'subscription.disable': {
        const code = data.subscription_code ?? data.subscription?.subscription_code
        if (!code) break

        await db
          .from('us_subscriptions')
          .update({ status: 'canceled' })
          .eq('paystack_subscription_code', code)

        const { data: sub } = await db.from('us_subscriptions').select('client_id').eq('paystack_subscription_code', code).maybeSingle()
        if (sub?.client_id) {
          await applyPlan(db, sub.client_id, 'free', 'canceled')
        }
        break
      }

      case 'invoice.payment_failed': {
        const code = data.subscription?.subscription_code ?? data.subscription_code
        if (code) {
          await db
            .from('us_subscriptions')
            .update({ status: 'past_due' })
            .eq('paystack_subscription_code', code)

          const { data: sub } = await db.from('us_subscriptions').select('client_id').eq('paystack_subscription_code', code).maybeSingle()
          if (sub?.client_id) {
            const { data: client } = await db.from('us_clients').select('profile_id, plan_tier').eq('id', sub.client_id).maybeSingle()
            if (client?.profile_id) {
              await db.from('profiles').update({ subscription_status: 'past_due' }).eq('id', client.profile_id)
              const { data: profile } = await db.from('profiles').select('email').eq('id', client.profile_id).maybeSingle()
              const toEmail = data.customer?.email ?? profile?.email
              if (toEmail) {
                await sendPaymentFailedEmail(toEmail)
              }
            }
          }
        }
        break
      }

      default:
        break // unknown events acknowledged, not processed
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[billing/webhook] processing failed:', err)
    return NextResponse.json({ ok: false }, { status: 500 }) // Paystack retries on non-200
  }
}
