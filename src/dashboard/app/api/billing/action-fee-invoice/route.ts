import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createActionFeeInvoice } from '@/lib/billing/paystack'
import { getPlanConfig, normalizePlanId } from '@/lib/tiers'
import { getEnvVar } from '@/lib/cf-env'
import { registerDocument } from '@/lib/documents/registry'
import { dispatch } from '@/lib/notifications/dispatch'
import { ACTION_STATUSES } from '@/types/constants'
import { authorizeCron } from '@/lib/cron'

export const dynamic = 'force-dynamic'

const METERED_TIERS = new Set(['starter', 'pro', 'business'])

/**
 * POST /api/billing/action-fee-invoice
 *
 * Runs on the 1st of each month via cron. For every metered client, counts the
 * billable actions of the previous month (status=executed AND result=success:
 * the billing invariant from executor.ts) and invoices any overage via Paystack.
 */
export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createServiceClient()
    const secretKey = await getEnvVar('PAYSTACK_SECRET_KEY')
    if (!secretKey) throw new Error('Missing PAYSTACK_SECRET_KEY')

    const { data: clients, error: fetchErr } = await supabase
      .from('us_clients')
      .select('id, profile_id, plan_tier, us_subscriptions(paystack_customer_code, status)')
      .in('plan_tier', [...METERED_TIERS])

    if (fetchErr) throw fetchErr
    if (!clients || clients.length === 0) return NextResponse.json({ ok: true, processed: 0 })

    const now = new Date()
    const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const periodLabel = firstOfLastMonth.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const periodString = `${firstOfLastMonth.getUTCFullYear()}-${String(firstOfLastMonth.getUTCMonth() + 1).padStart(2, '0')}`

    let processed = 0

    for (const client of clients as any[]) {
      try {
        const sub = Array.isArray(client.us_subscriptions) ? client.us_subscriptions[0] : client.us_subscriptions
        const customerCode: string | undefined = sub?.paystack_customer_code
        if (!customerCode) continue

        const plan = getPlanConfig(normalizePlanId(client.plan_tier))
        if (!Number.isFinite(plan.limits.actionsIncluded) || plan.limits.overagePerAction <= 0) continue

        const { count, error: countErr } = await supabase
          .from('us_actions')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', ACTION_STATUSES.EXECUTED)
          .eq('result', 'success')
          .gte('executed_at', firstOfLastMonth.toISOString())
          .lt('executed_at', firstOfThisMonth.toISOString())
        if (countErr) throw countErr

        const overageActions = Math.max(0, (count ?? 0) - plan.limits.actionsIncluded)
        if (overageActions <= 0) continue

        // overagePerAction is in USD cents; Paystack amounts are in the smallest unit
        const amountKobo = overageActions * plan.limits.overagePerAction
        const reference = `${client.id}_${periodString}_actions`

        const result = await createActionFeeInvoice({
          reference,
          paystackCustomerCode: customerCode,
          amountKobo,
          description: `UserSessions.io action overage for ${periodLabel} (${overageActions} actions over ${plan.limits.actionsIncluded} included)`,
          periodLabel,
          secretKey,
        })

        if ('error' in result) {
          console.error(`[Billing/ActionFee] Failed to create invoice for client ${client.id}:`, result.error)
          continue
        }

        if (!result.alreadyExisted) {
          await registerDocument({
            client_id: client.id,
            doc_type: 'invoice',
            period_start: firstOfLastMonth.toISOString(),
            period_end: new Date(firstOfThisMonth.getTime() - 1).toISOString(),
            storage_path: null,
            external_url: `https://paystack.com/invoice/${result.paystackId}`,
            doc_version: null,
            sent_at: new Date().toISOString(),
            sent_to: [],
            metadata: { paystack_id: result.paystackId, request_code: result.requestCode, amount: amountKobo, overage_actions: overageActions, status: 'pending' },
          })

          const { data: profile } = await supabase.from('profiles').select('email').eq('id', client.profile_id).maybeSingle()
          if (profile?.email) {
            await dispatch({
              event_type: 'monthly_invoice', source_type: 'billing', source_id: result.requestCode,
              client_id: client.id, recipient_user_id: client.profile_id, recipient_email: profile.email,
              severity: 'P2', metadata: { amount: amountKobo, periodLabel, overageActions },
            }, {
              title: 'New Monthly Invoice',
              body: `Your action-fee overage invoice for ${periodLabel} is ready.`,
            })
          }
        }

        processed++
      } catch (err) {
        console.error(`[Billing/ActionFee] Failed processing client ${client.id}:`, err)
      }
    }

    return NextResponse.json({ ok: true, processed, periodLabel })
  } catch (error: any) {
    console.error('[Billing/ActionFee] Error:', error)
    return NextResponse.json({ error: error?.message ?? 'Action fee invoicing failed' }, { status: 500 })
  }
}
