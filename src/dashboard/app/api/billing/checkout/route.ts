import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEnvVar } from '@/lib/cf-env'
import type { CalculatorTierId } from '@/lib/documents/types'

// Force dynamic: Supabase URL is a runtime env var on Cloudflare, not a build var.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tier,
      email: bodyEmail,
      companyName,
      sessions,
      issues,
      automation,
      clientId,
    }: {
      tier: CalculatorTierId
      email?: string
      companyName?: string
      sessions?: number
      issues?: number
      automation?: number
      clientId?: string
    } = body

    // --- Enterprise path: no direct charge online, route to sales contact ---
    if (tier === 'enterprise_managed' || tier === 'enterprise_license') {
      const siteUrl = await getEnvVar('NEXT_PUBLIC_SITE_URL') ?? 'https://usersessions.io'
      const calcParams = new URLSearchParams()
      if (sessions) calcParams.set('sessions', String(sessions))
      if (issues) calcParams.set('issues', String(issues))
      if (automation) calcParams.set('automation', String(automation))
      calcParams.set('tier', tier)
      calcParams.set('source', 'calculator')
      if (companyName) calcParams.set('company', companyName)

      const contactParams = new URLSearchParams({
        subject: `Enterprise plan enquiry: ${tier}`,
        config: `${siteUrl}/pricing?${calcParams.toString()}`,
        company: companyName ?? '',
      })

      return NextResponse.json({
        checkoutMode: 'contact_sales',
        contactUrl: `${siteUrl}/contact?${contactParams.toString()}`,
      })
    }

    // --- Self-serve checkout path: initialize Paystack Pop transaction ---
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Allow unauthenticated visitors to start checkout with email from body
    const email = user?.email ?? bodyEmail
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    // The webhook trusts metadata.client_id first, so it must come from the session,
    // never from the request body. Anonymous checkouts are matched by email.
    let ownedClientId: string | null = null
    if (user) {
      const { data: own } = await supabase.from('us_clients').select('id').eq('profile_id', user.id).maybeSingle()
      ownedClientId = own?.id ?? null
      if (clientId && clientId !== ownedClientId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Resolve the plan code based on tier
    let paystackPlanCode: string | null = null
    if (tier === 'starter') {
      paystackPlanCode = (await getEnvVar('PAYSTACK_PLAN_STARTER_MONTHLY')) ?? null
    } else if (tier === 'pro') {
      paystackPlanCode = (await getEnvVar('PAYSTACK_PLAN_PRO_MONTHLY')) ?? null
    } else if (tier === 'business') {
      paystackPlanCode = (await getEnvVar('PAYSTACK_PLAN_BUSINESS_MONTHLY')) ?? null
    }

    if (!paystackPlanCode) {
      console.error(`[Billing] Missing Paystack plan code env var for tier: ${tier}`)
      return NextResponse.json({ error: 'Plan not configured' }, { status: 500 })
    }

    const paystackPublicKey = await getEnvVar('PAYSTACK_PUBLIC_KEY')
    const secretKey = await getEnvVar('PAYSTACK_SECRET_KEY')
    if (!secretKey || !paystackPublicKey) {
      console.error('[Billing] Missing Paystack keys')
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 })
    }

    // Fetch the plan amount from Paystack (plan is source of truth for amount)
    const API = 'https://api.paystack.co'
    const planRes = await fetch(`${API}/plan/${encodeURIComponent(paystackPlanCode)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    if (!planRes.ok) {
      const text = await planRes.text()
      console.error('[Billing] Plan lookup failed:', text)
      return NextResponse.json({ error: 'plan_lookup_failed' }, { status: 502 })
    }
    const planPayload = await planRes.json()
    const amount = Number(planPayload?.data?.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'plan_has_no_amount' }, { status: 500 })
    }

    // Deterministic reference for this checkout session
    const reference = `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const siteUrl = await getEnvVar('NEXT_PUBLIC_SITE_URL') ?? 'https://usersessions.io'

    return NextResponse.json({
      checkoutMode: 'paystack_pop',
      paystackPublicKey,
      email,
      paystackPlanCode,
      amount,
      reference,
      callbackUrl: `${siteUrl}/settings?billing=success`,
      metadata: {
        user_id: user?.id ?? null,
        client_id: ownedClientId,
        company_name: typeof companyName === 'string' ? companyName.slice(0, 120) : null,
        tier,
      },
    })
  } catch (error: any) {
    console.error('[Billing] Checkout error:', error)
    return NextResponse.json({ error: error.message ?? 'Checkout failed' }, { status: 500 })
  }
}
