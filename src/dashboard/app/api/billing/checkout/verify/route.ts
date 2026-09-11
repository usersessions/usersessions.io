import { NextRequest, NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/cf-env'

export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/checkout/verify
 *
 * Lightweight server-side confirmation that a Paystack transaction succeeded.
 * Used by CheckoutModal to flip the UI to the success screen after Paystack Pop.
 *
 * Account provisioning fires from the charge.success webhook — this is UI-only.
 */
export async function POST(req: NextRequest) {
  try {
    const { reference } = await req.json()
    if (!reference || typeof reference !== 'string') {
      return NextResponse.json({ error: 'reference is required' }, { status: 400 })
    }

    const secretKey = await getEnvVar('PAYSTACK_SECRET_KEY')
    if (!secretKey) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 })
    }

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    )

    if (!res.ok) {
      const text = await res.text()
      console.error('[Billing/Verify] Paystack verification failed:', text)
      return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 502 })
    }

    const payload = await res.json()
    const status = payload?.data?.status

    if (status !== 'success') {
      return NextResponse.json({ ok: false, status }, { status: 402 })
    }

    return NextResponse.json({
      ok: true,
      status,
      amount: payload?.data?.amount,
      currency: payload?.data?.currency,
      plan: payload?.data?.plan?.plan_code ?? null,
    })
  } catch (error: any) {
    console.error('[Billing/Verify] Error:', error)
    return NextResponse.json({ ok: false, error: error.message ?? 'verify_error' }, { status: 500 })
  }
}
