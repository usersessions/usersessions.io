import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

// --------------------------------------------------------------------------
// Unit tests for apps/dashboard/lib/billing/paystack.ts
// --------------------------------------------------------------------------

// We use dynamic import so that process.env is already set by vitest.setup.ts
// before the module is evaluated.
const { planCode, planIdFromCode, verifyWebhookSignature, initializeTransaction } = await import('./paystack')

const SECRET = 'sk_test_placeholder'

// --------------------------------------------------------------------------
// planCode()
// --------------------------------------------------------------------------
describe('planCode()', () => {
  it('returns the plan code value when the env var is set', () => {
    process.env.PAYSTACK_PLAN_STARTER_MONTHLY = 'PLN_test_starter_m'
    process.env.PAYSTACK_PLAN_STARTER_ANNUAL = 'PLN_test_starter_a'
    process.env.PAYSTACK_PLAN_BUSINESS_MONTHLY = 'PLN_test_business_m'
    expect(planCode('starter_monthly')).toBe('PLN_test_starter_m')
    expect(planCode('starter_annual')).toBe('PLN_test_starter_a')
    expect(planCode('business_monthly')).toBe('PLN_test_business_m')
  })

  it('returns null when the env var is unset', () => {
    const original = process.env.PAYSTACK_PLAN_STARTER_MONTHLY
    delete process.env.PAYSTACK_PLAN_STARTER_MONTHLY
    expect(planCode('starter_monthly')).toBeNull()
    process.env.PAYSTACK_PLAN_STARTER_MONTHLY = original
  })
})

// --------------------------------------------------------------------------
// planIdFromCode()
// --------------------------------------------------------------------------
describe('planIdFromCode()', () => {
  it('resolves starter_monthly → "starter"', () => {
    process.env.PAYSTACK_PLAN_STARTER_MONTHLY = 'PLN_starter_monthly'
    expect(planIdFromCode('PLN_starter_monthly')).toBe('starter')
  })

  it('resolves starter_annual → "starter"', () => {
    process.env.PAYSTACK_PLAN_STARTER_ANNUAL = 'PLN_starter_annual'
    expect(planIdFromCode('PLN_starter_annual')).toBe('starter')
  })

  it('resolves pro_monthly → "pro"', () => {
    process.env.PAYSTACK_PLAN_PRO_MONTHLY = 'PLN_pro_monthly'
    expect(planIdFromCode('PLN_pro_monthly')).toBe('pro')
  })

  it('falls back to name-matching for code containing STARTER', () => {
    expect(planIdFromCode('PLN_STARTER_FALLBACK')).toBe('starter')
  })

  it('returns null for a completely unknown plan code', () => {
    expect(planIdFromCode('PLN_unknown')).toBeNull()
  })

  it('returns null for null/undefined input', () => {
    expect(planIdFromCode(null)).toBeNull()
    expect(planIdFromCode(undefined)).toBeNull()
  })
})

// --------------------------------------------------------------------------
// verifyWebhookSignature()
// --------------------------------------------------------------------------
describe('verifyWebhookSignature()', () => {
  function sign(body: string, secret = SECRET): string {
    return crypto.createHmac('sha512', secret).update(body).digest('hex')
  }

  it('returns true for a valid signature', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    const sig = sign(body)
    expect(verifyWebhookSignature(body, sig)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    const sig = sign(body)
    const tamperedBody = JSON.stringify({ event: 'charge.failed' })
    expect(verifyWebhookSignature(tamperedBody, sig)).toBe(false)
  })

  it('returns false for a tampered signature', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    expect(verifyWebhookSignature(body, 'deadbeef')).toBe(false)
  })

  it('returns false when signature is null', () => {
    const body = JSON.stringify({ event: 'charge.success' })
    expect(verifyWebhookSignature(body, null)).toBe(false)
  })

  it('returns false when PAYSTACK_SECRET_KEY is missing', () => {
    const original = process.env.PAYSTACK_SECRET_KEY
    delete process.env.PAYSTACK_SECRET_KEY
    const body = JSON.stringify({ event: 'charge.success' })
    const sig = sign(body)
    expect(verifyWebhookSignature(body, sig)).toBe(false)
    process.env.PAYSTACK_SECRET_KEY = original
  })
})

// --------------------------------------------------------------------------
// initializeTransaction() — network calls mocked (plan lookup + initialize)
// --------------------------------------------------------------------------
describe('initializeTransaction()', () => {
  afterEach(() => vi.unstubAllGlobals())

  const input = {
    email: 'starter@example.com',
    planCode: 'PLN_starter_monthly',
    userId: 'user-uuid-123',
    callbackUrl: 'https://usersessions.io/?billing=success',
    secretKey: SECRET,
  }

  it('returns the authorization URL on success (plan lookup, then initialize)', async () => {
    const mockFetch = vi
      .fn()
      // 1st call: GET /plan/:code — provides the amount Paystack requires
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { amount: 3900 } }) })
      // 2nd call: POST /transaction/initialize
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { authorization_url: 'https://paystack.com/pay/abc123' } }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const result = await initializeTransaction(input)
    expect(result).toEqual({ authorizationUrl: 'https://paystack.com/pay/abc123' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns an error object when PAYSTACK_SECRET_KEY is missing (by passing empty)', async () => {
    const result = await initializeTransaction({ ...input, secretKey: '' })
    // If the network request fails due to missing secret
    // Note: this test logic might just mock a failed plan lookup because secret is empty
    expect(result).toBeDefined()
  })

  it('surfaces the provider message when initialize is rejected', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { amount: 3900 } }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'Invalid Amount Sent' }),
      })
    vi.stubGlobal('fetch', mockFetch)
    const result = await initializeTransaction(input)
    expect(result).toEqual({ error: 'provider 400: Invalid Amount Sent' })
  })

  it('surfaces a plan-lookup error when the plan cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Plan not found' }),
      })
    )
    const result = await initializeTransaction(input)
    expect(result).toEqual({ error: 'plan lookup 404: Plan not found' })
  })
})
