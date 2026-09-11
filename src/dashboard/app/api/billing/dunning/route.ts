import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { dispatch } from '@/lib/notifications/dispatch'
import { chargeAuthorization } from '@/lib/billing/paystack'
import { getEnvVar } from '@/lib/cf-env'
import { authorizeCron } from '@/lib/cron'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/dunning
 *
 * Cron-driven sweep for failed invoice payments (rows in us_billing_dunning with
 * next_retry_at in the past).
 *   Attempt 1 (day 3): retry charge; on failure email.
 *   Attempt 2 (day 7): retry charge; on failure P0 in-app + email.
 *   Attempt 3 (day 14): mark escalated_manual.
 *
 * Runs with the service client: there is no user session in a cron.
 */
export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createServiceClient()

    const { data: rows, error: fetchErr } = await supabase
      .from('us_billing_dunning')
      .select('*, us_clients(profile_id), us_subscriptions:client_id(paystack_customer_code)')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .limit(50)

    if (fetchErr) throw fetchErr
    if (!rows || rows.length === 0) return NextResponse.json({ ok: true, processed: 0 })

    const secretKey = await getEnvVar('PAYSTACK_SECRET_KEY')
    if (!secretKey) throw new Error('Missing PAYSTACK_SECRET_KEY')

    let processed = 0

    for (const row of rows as any[]) {
      try {
        const profileId: string | undefined = row.us_clients?.profile_id
        if (!profileId) continue

        // us_subscriptions is keyed by client_id (UNIQUE), so the join is 0..1 rows
        const sub = Array.isArray(row.us_subscriptions) ? row.us_subscriptions[0] : row.us_subscriptions
        const customerCode: string | undefined = sub?.paystack_customer_code

        const { data: profile } = await supabase.from('profiles').select('email').eq('id', profileId).maybeSingle()
        const email = profile?.email
        if (!email) continue

        let chargeResult: { success: boolean } = { success: false }
        const nextAttempt = (row.attempt ?? 0) + 1

        if (nextAttempt <= 2 && customerCode) {
          const custRes = await fetch(`https://api.paystack.co/customer/${encodeURIComponent(customerCode)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
          })
          if (custRes.ok) {
            const custPayload = await custRes.json()
            const authorizations: any[] = custPayload?.data?.authorizations || []
            const activeAuth = authorizations.find((a) => a.active === true && a.authorization_code)
            if (activeAuth) {
              chargeResult = await chargeAuthorization({
                authorizationCode: activeAuth.authorization_code,
                email,
                amountKobo: row.amount_kobo,
                reference: `retry_${row.id}_${nextAttempt}_${Date.now()}`,
                secretKey,
              })
            }
          }
        }

        if (chargeResult.success) {
          await supabase.from('us_billing_dunning')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', row.id)
          processed++
          continue
        }

        const sourceId = row.paystack_invoice_code || row.invoice_reference || row.id

        if (nextAttempt === 1) {
          await supabase.from('us_billing_dunning')
            .update({ attempt: 1, next_retry_at: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString() })
            .eq('id', row.id)
          await dispatch({
            event_type: 'payment_failed', source_type: 'billing', source_id: sourceId,
            client_id: row.client_id, recipient_user_id: profileId, recipient_email: email,
            severity: 'P2', metadata: { attempt: 1, amount: row.amount_kobo },
          }, {
            title: 'Payment Action Required',
            body: 'We were unable to process your payment. Please update your billing details.',
          })
        } else if (nextAttempt === 2) {
          await supabase.from('us_billing_dunning')
            .update({ attempt: 2, next_retry_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() })
            .eq('id', row.id)
          await dispatch({
            event_type: 'payment_failed', source_type: 'billing', source_id: sourceId,
            client_id: row.client_id, recipient_user_id: profileId, recipient_email: email,
            severity: 'P0', metadata: { attempt: 2, amount: row.amount_kobo },
          }, {
            title: 'Final Payment Reminder',
            body: 'Your account is at risk of suspension due to an unpaid invoice. Please update your billing details immediately.',
          })
        } else {
          await supabase.from('us_billing_dunning')
            .update({ attempt: 3, status: 'escalated_manual', next_retry_at: null })
            .eq('id', row.id)
        }

        processed++
      } catch (err) {
        console.error(`[Billing/Dunning] Failed to process row ${row.id}`, err)
      }
    }

    return NextResponse.json({ ok: true, processed })
  } catch (error: any) {
    console.error('[Billing/Dunning] Error:', error)
    return NextResponse.json({ error: error?.message ?? 'Dunning sweep failed' }, { status: 500 })
  }
}
