import crypto from 'crypto'

/**
 *
 * Paystack lacks global reach and automated tax handling (e.g. VAT, US Sales Tax) required 
 * for the broad-market, self-serve global motion of UserSessions.io v3. 
 * This file and its usages should be audited and migrated.
 * 
 * Paystack integration (BUILD_SPEC §11). Subscription-only — no one-time SKU exists.
 * Plan codes are created in the Paystack dashboard and provided via env vars.
 * PRE-LAUNCH GATE: confirm settlement currency approval before flipping the billing flag.
 */

const API = 'https://api.paystack.co'

export type PaidPlanKey =
  | 'starter_monthly'
  | 'starter_annual'
  | 'pro_monthly'
  | 'pro_annual'
  | 'business_monthly'
  | 'business_annual'

const PLAN_ENV: Record<PaidPlanKey, string> = {
  starter_monthly: 'PAYSTACK_PLAN_STARTER_MONTHLY',
  starter_annual:  'PAYSTACK_PLAN_STARTER_ANNUAL',
  pro_monthly:     'PAYSTACK_PLAN_PRO_MONTHLY',
  pro_annual:      'PAYSTACK_PLAN_PRO_ANNUAL',
  business_monthly: 'PAYSTACK_PLAN_BUSINESS_MONTHLY',
  business_annual:  'PAYSTACK_PLAN_BUSINESS_ANNUAL',
}

export function planCode(key: PaidPlanKey): string | null {
  return process.env[PLAN_ENV[key]] ?? null
}

/** Reverse mapping: Paystack plan_code → our PlanId, for webhook processing. */
export function planIdFromCode(code: string | null | undefined): 'starter' | 'pro' | 'business' | 'enterprise' | null {
  if (!code) return null
  
  const starterCodes = [process.env.PAYSTACK_PLAN_STARTER_MONTHLY, process.env.PAYSTACK_PLAN_STARTER_ANNUAL].filter(Boolean)
  const proCodes = [process.env.PAYSTACK_PLAN_PRO_MONTHLY, process.env.PAYSTACK_PLAN_PRO_ANNUAL].filter(Boolean)
  const businessCodes = [process.env.PAYSTACK_PLAN_BUSINESS_MONTHLY, process.env.PAYSTACK_PLAN_BUSINESS_ANNUAL].filter(Boolean)
  
  if (starterCodes.includes(code)) return 'starter'
  if (proCodes.includes(code)) return 'pro'
  if (businessCodes.includes(code)) return 'business'
  
  // Fallback: name-based matching when plan codes aren't set in env
  const upper = code.toUpperCase()
  if (upper.includes('STARTER')) return 'starter'
  if (upper.includes('BUSINESS')) return 'business'
  if (upper.includes('ENTERPRISE')) return 'enterprise'
  if (upper.includes('PRO')) return 'pro'

  return null
}

export async function initializeTransaction(input: {
  email: string
  planCode: string
  userId: string
  callbackUrl: string
  secretKey: string
}): Promise<{ authorizationUrl: string } | { error: string }> {
  const secret = input.secretKey

  try {
    // Paystack's transaction/initialize requires an explicit amount even when a
    // plan is supplied ("Invalid Amount Sent" otherwise); the plan's own amount is
    // authoritative, so we fetch it and pass it through. Paystack overrides the
    // charge with the plan amount server-side regardless.
    const planRes = await fetch(`${API}/plan/${encodeURIComponent(input.planCode)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (!planRes.ok) {
      const planErr = await planRes.text()
      console.error(`[Billing] Plan lookup failed for ${input.planCode} (Status: ${planRes.status}):`, planErr)
      let planMsg = ''
      try {
        planMsg = String(JSON.parse(planErr)?.message ?? '')
      } catch {
        /* not JSON */
      }
      return { error: `plan lookup ${planRes.status}${planMsg ? `: ${planMsg.slice(0, 140)}` : ''}` }
    }
    const planPayload = await planRes.json()
    const amount = Number(planPayload?.data?.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('[Billing] Plan has no valid amount:', planPayload)
      return { error: 'plan_has_no_amount' }
    }

    const res = await fetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        amount,
        plan: input.planCode,
        metadata: { user_id: input.userId },
        callback_url: input.callbackUrl,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[Billing] Paystack API rejected initialization (Status: ${res.status}):`, errorText)
      let message = ''
      try {
        message = String(JSON.parse(errorText)?.message ?? '')
      } catch {
        /* not JSON */
      }
      return { error: `provider ${res.status}${message ? `: ${message.slice(0, 140)}` : ''}` }
    }

    const payload = await res.json()
    const url = payload?.data?.authorization_url
    if (typeof url !== 'string') {
      console.error('[Billing] Paystack returned success but no authorization_url:', payload)
      return { error: 'no_authorization_url' }
    }
    return { authorizationUrl: url }
  } catch (err) {
    console.error('[Billing] Exception during Paystack initialization:', err)
    return { error: 'network_error' }
  }
}

/** Paystack signs webhooks with your secret key: HMAC-SHA512 over the raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

/**
 * Recover the active subscription's code + email_token straight from Paystack.
 * Self-healing fallback for cancellation when the subscription.create webhook
 * never stored them (missed delivery, misconfigured webhook URL, etc.).
 */
export async function findActiveSubscription(
  customerCode: string
): Promise<{ subscriptionCode: string; emailToken: string } | null> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return null
  const headers = { Authorization: `Bearer ${secret}` }
  try {
    const custRes = await fetch(`${API}/customer/${encodeURIComponent(customerCode)}`, { headers })
    if (!custRes.ok) return null
    const cust = await custRes.json()
    const customerId = cust?.data?.id
    if (!customerId) return null

    const subRes = await fetch(`${API}/subscription?customer=${customerId}&perPage=20`, { headers })
    if (!subRes.ok) return null
    const subs = await subRes.json()
    const rows: any[] = Array.isArray(subs?.data) ? subs.data : []
    const active = rows.find((s) => ['active', 'non-renewing', 'attention'].includes(String(s?.status)))
    if (!active?.subscription_code || !active?.email_token) return null
    return { subscriptionCode: String(active.subscription_code), emailToken: String(active.email_token) }
  } catch {
    return null
  }
}

/**
 * Turn off auto-renew (BUILD_SPEC §11: email_token stored for cancellation).
 * The subscription stays active until the end of the paid period — Paystack's
 * subscription/disable semantics, mirrored as subscription_status='non_renewing'.
 */
export async function disableSubscription(code: string, emailToken: string): Promise<boolean> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return false
  try {
    const res = await fetch(`${API}/subscription/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, token: emailToken }),
    })
    if (!res.ok) return false
    const payload = await res.json()
    return Boolean(payload?.status)
  } catch {
    return false
  }
}

export interface BillingTransaction {
  reference: string
  amountSubunit: number
  currency: string
  status: string
  paidAt: string | null
  channel: string | null
}

/**
 * Last payments for a customer, for the Settings billing history.
 * Paystack's /transaction list filters by numeric customer ID, so we resolve
 * the stored customer code first. Read-only; ALWAYS fails soft to [] — a
 * Paystack outage must never take down the Settings page.
 */
export async function listTransactions(customerCode: string, limit = 12): Promise<BillingTransaction[]> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return []
  const headers = { Authorization: `Bearer ${secret}` }
  try {
    const custRes = await fetch(`${API}/customer/${encodeURIComponent(customerCode)}`, { headers })
    if (!custRes.ok) return []
    const cust = await custRes.json()
    const customerId = cust?.data?.id
    if (!customerId) return []

    const txRes = await fetch(`${API}/transaction?customer=${customerId}&perPage=${limit}`, { headers })
    if (!txRes.ok) return []
    const tx = await txRes.json()
    const rows: any[] = Array.isArray(tx?.data) ? tx.data : []
    return rows.map((t) => ({
      reference: String(t?.reference ?? ''),
      amountSubunit: Number(t?.amount ?? 0),
      currency: String(t?.currency ?? ''),
      status: String(t?.status ?? 'unknown'),
      paidAt: t?.paid_at ?? null,
      channel: t?.channel ?? null,
    }))
  } catch {
    return []
  }
}

/**
 * Look up an existing Paystack Invoice by our deterministic reference string.
 * Returns the invoice object if found, or null — used for duplicate prevention
 * before createActionFeeInvoice, since Paystack has no idempotency-key
 * guarantee on invoice creation.
 */
export async function getInvoiceByReference(
  reference: string,
  secretKey: string
): Promise<{ id: string; status: string; amount: number } | null> {
  try {
    // Paystack doesn't have a direct "get invoice by reference" endpoint;
    // we use the invoices list with a search filter.
    const res = await fetch(
      `${API}/paymentrequest?reference=${encodeURIComponent(reference)}&perPage=1`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    )
    if (!res.ok) return null
    const payload = await res.json()
    const rows: any[] = Array.isArray(payload?.data) ? payload.data : []
    const match = rows.find((r) => String(r?.request_code) === reference || String(r?.offline_reference) === reference)
    if (!match) return null
    return {
      id: String(match.id ?? ''),
      status: String(match.status ?? 'unknown'),
      amount: Number(match.amount ?? 0),
    }
  } catch {
    return null
  }
}

export interface ActionFeeInvoiceInput {
  /** Our deterministic reference: `{client_id}_{YYYY-MM}_actions` */
  reference: string
  /** Paystack customer code stored on us_clients */
  paystackCustomerCode: string
  /** Amount in kobo (100 kobo = $1 USD, or local currency equivalent) */
  amountKobo: number
  /** Human-readable description on the invoice line item */
  description: string
  /** Billing period label, e.g. "July 2026" */
  periodLabel: string
  secretKey: string
  /** ISO date string for invoice due date (default: 7 days from now) */
  dueDate?: string
}

export interface ActionFeeInvoiceResult {
  /** Paystack invoice/payment-request ID */
  paystackId: string
  /** Paystack request_code */
  requestCode: string
  /** Whether this was a newly created invoice or an existing one (idempotency) */
  alreadyExisted: boolean
}

/**
 * Create (or find existing) a Paystack Invoice for action-fee overage.
 *
 * Paystack uses the Payment Requests API (/paymentrequest) to send invoices
 * to customers. We key off a deterministic `reference` and check for an
 * existing invoice before creating — explicit duplicate prevention.
 *
 * Invoice amounts in smallest currency unit (kobo for NGN, cents for USD).
 */
export async function createActionFeeInvoice(
  input: ActionFeeInvoiceInput
): Promise<ActionFeeInvoiceResult | { error: string }> {
  const secret = input.secretKey

  // 1. Check for existing invoice with this reference (idempotency guard)
  const existing = await getInvoiceByReference(input.reference, secret)
  if (existing) {
    return {
      paystackId: existing.id,
      requestCode: input.reference,
      alreadyExisted: true,
    }
  }

  // 2. Resolve Paystack numeric customer ID from the customer code
  try {
    const custRes = await fetch(`${API}/customer/${encodeURIComponent(input.paystackCustomerCode)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (!custRes.ok) return { error: `customer_lookup_${custRes.status}` }
    const cust = await custRes.json()
    const customerEmail = cust?.data?.email
    if (!customerEmail) return { error: 'customer_has_no_email' }

    const dueDate = input.dueDate ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0]

    // 3. Create the Payment Request (Paystack's invoice equivalent)
    const res = await fetch(`${API}/paymentrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerEmail,
        amount: input.amountKobo,
        due_date: dueDate,
        description: input.description,
        line_items: [{
          name: `Action-fee overage — ${input.periodLabel}`,
          amount: input.amountKobo,
          quantity: 1,
        }],
        offline_reference: input.reference,
        send_notification: false, // We send our own branded email
        draft: false,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      let msg = ''
      try { msg = String(JSON.parse(errText)?.message ?? '') } catch { /* not JSON */ }
      return { error: `paystack_${res.status}${msg ? `: ${msg.slice(0, 120)}` : ''}` }
    }

    const payload = await res.json()
    const id = String(payload?.data?.id ?? '')
    const requestCode = String(payload?.data?.request_code ?? '')
    if (!id) return { error: 'no_invoice_id_returned' }

    return { paystackId: id, requestCode, alreadyExisted: false }
  } catch (err) {
    console.error('[Billing] createActionFeeInvoice exception:', err)
    return { error: 'network_error' }
  }
}

/**
 * Charge a customer's stored card authorization for dunning retries.
 * Used by the dunning sweep on day-3 and day-7 retry attempts.
 */
export async function chargeAuthorization(input: {
  authorizationCode: string
  email: string
  amountKobo: number
  reference: string
  secretKey: string
}): Promise<{ success: boolean; status: string; reference: string }> {
  try {
    const res = await fetch(`${API}/transaction/charge_authorization`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorization_code: input.authorizationCode,
        email: input.email,
        amount: input.amountKobo,
        reference: input.reference,
      }),
    })
    const payload = await res.json()
    return {
      success: payload?.data?.status === 'success',
      status: String(payload?.data?.status ?? 'failed'),
      reference: String(payload?.data?.reference ?? input.reference),
    }
  } catch {
    return { success: false, status: 'error', reference: input.reference }
  }
}
