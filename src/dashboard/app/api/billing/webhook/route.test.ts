import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// --------------------------------------------------------------------------
// Integration-style tests for POST /api/billing/webhook
//
// Supabase and the email triggers are mocked so the handler runs without a
// database. The mock is a recording, chainable, thenable query builder so we
// can assert on which tables / operations / payloads the route touched.
// --------------------------------------------------------------------------

const SECRET = 'sk_test_webhook_secret_for_unit_tests_only_0000'
process.env.PAYSTACK_SECRET_KEY = SECRET

function sign(body: string): string {
  return crypto.createHmac('sha512', SECRET).update(body).digest('hex')
}

// ------ Recording Supabase mock ------
interface Call { table: string; op: string; args: unknown[] }
const calls: Call[] = []

const ROWS: Record<string, unknown> = {
  profiles: { id: 'user-uuid-123', email: 'test@example.com' },
  us_clients: { id: 'client-1', profile_id: 'user-uuid-123' },
  us_subscriptions: { client_id: 'client-1' },
}

function builder(table: string) {
  const b: any = {}
  const record = (op: string) => (...args: unknown[]) => { calls.push({ table, op, args }); return b }
  for (const op of ['select', 'update', 'insert', 'upsert', 'eq', 'in', 'gte', 'lt', 'not', 'order', 'limit']) b[op] = record(op)
  b.maybeSingle = async () => ({ data: ROWS[table] ?? null, error: null })
  b.single = b.maybeSingle
  b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve, reject)
  return b
}

const mockDb = { from: vi.fn((table: string) => builder(table)) }

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockDb,
  createClient: vi.fn(),
}))

vi.mock('@/lib/email/triggers', () => ({
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/flags', () => ({
  isEnabled: vi.fn().mockResolvedValue(false),
}))

beforeEach(() => {
  calls.length = 0
  mockDb.from.mockClear()
})

const { POST } = await import('./route')

function makeRequest(body: object, signature?: string): Request {
  const raw = JSON.stringify(body)
  const sig = signature ?? sign(raw)
  return new Request('https://usersessions.io/api/billing/webhook', {
    method: 'POST',
    body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig },
  })
}

function tables(): string[] {
  return mockDb.from.mock.calls.map((c) => c[0] as string)
}

function ops(table: string, op: string): Call[] {
  return calls.filter((c) => c.table === table && c.op === op)
}

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook: signature validation', () => {
  it('rejects an invalid signature with 401 and touches no tables', async () => {
    const res = await POST(makeRequest({ event: 'charge.success' }, 'bad-signature'))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('INVALID_SIGNATURE')
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it('rejects a malformed JSON body with 400', async () => {
    const raw = '{not json'
    const res = await POST(new Request('https://usersessions.io/api/billing/webhook', {
      method: 'POST', body: raw, headers: { 'x-paystack-signature': sign(raw) },
    }))
    expect(res.status).toBe(400)
  })

  it('accepts a valid HMAC-SHA512 signature with 200', async () => {
    const res = await POST(makeRequest({
      event: 'charge.success',
      data: {
        metadata: { user_id: 'user-uuid-123' },
        customer: { customer_code: 'CUS_abc', email: 'test@example.com' },
        plan: { plan_code: 'PLN_starter_monthly' },
        amount: 2000, currency: 'USD', reference: 'ref_abc',
      },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook: charge.success', () => {
  it('activates the subscription and updates the client plan tier', async () => {
    const res = await POST(makeRequest({
      event: 'charge.success',
      data: {
        metadata: { client_id: 'client-1' },
        customer: { customer_code: 'CUS_abc', email: 'test@example.com' },
        plan: { plan_code: 'PLN_starter_monthly' },
        amount: 4900, currency: 'USD', reference: 'ref_abc',
      },
    }))
    expect(res.status).toBe(200)
    expect(tables()).toContain('us_subscriptions')
    expect(tables()).toContain('us_clients')

    const [subUpdate] = ops('us_subscriptions', 'update')
    expect(subUpdate.args[0]).toMatchObject({ status: 'active', plan_code: 'PLN_starter_monthly' })

    const [clientUpdate] = ops('us_clients', 'update')
    expect(clientUpdate.args[0]).toHaveProperty('plan_tier')
  })

  it('resolves the client via user_id when client_id is absent', async () => {
    const res = await POST(makeRequest({
      event: 'charge.success',
      data: { metadata: { user_id: 'user-uuid-123' }, plan: { plan_code: 'PLN_starter_monthly' } },
    }))
    expect(res.status).toBe(200)
    const clientLookup = ops('us_clients', 'eq').find((c) => c.args[0] === 'profile_id')
    expect(clientLookup?.args[1]).toBe('user-uuid-123')
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook: subscription.create', () => {
  it('upserts us_subscriptions using Paystack next_payment_date for the period end', async () => {
    const res = await POST(makeRequest({
      event: 'subscription.create',
      data: {
        metadata: { client_id: 'client-1' },
        customer: { customer_code: 'CUS_abc', email: 'test@example.com' },
        plan: { plan_code: 'PLN_starter_annual' },
        subscription_code: 'SUB_xyz',
        email_token: 'email_token_abc',
        next_payment_date: '2099-01-01T00:00:00.000Z',
      },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)

    const [upsert] = ops('us_subscriptions', 'upsert')
    expect(upsert).toBeDefined()
    expect(upsert.args[0]).toMatchObject({
      client_id: 'client-1',
      paystack_customer_code: 'CUS_abc',
      paystack_subscription_code: 'SUB_xyz',
      plan_code: 'PLN_starter_annual',
      status: 'active',
      current_period_end: '2099-01-01T00:00:00.000Z',
    })
    expect(upsert.args[1]).toMatchObject({ onConflict: 'client_id' })
  })

  it('falls back to +30 days when next_payment_date is missing', async () => {
    const before = Date.now()
    await POST(makeRequest({
      event: 'subscription.create',
      data: { metadata: { client_id: 'client-1' }, subscription_code: 'SUB_xyz', plan: { plan_code: 'PLN_starter_monthly' } },
    }))
    const [upsert] = ops('us_subscriptions', 'upsert')
    const end = Date.parse((upsert.args[0] as any).current_period_end)
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    expect(end - before).toBeGreaterThan(thirtyDays - 60_000)
    expect(end - before).toBeLessThan(thirtyDays + 60_000)
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook: subscription.disable', () => {
  it('cancels the subscription and reverts the client to free', async () => {
    const res = await POST(makeRequest({ event: 'subscription.disable', data: { subscription_code: 'SUB_xyz' } }))
    expect(res.status).toBe(200)
    expect(ops('us_subscriptions', 'update')[0].args[0]).toMatchObject({ status: 'canceled' })
    expect(ops('us_clients', 'update')[0].args[0]).toMatchObject({ plan_tier: 'free' })
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook: invoice.payment_failed', () => {
  it('marks the subscription past_due', async () => {
    const res = await POST(makeRequest({
      event: 'invoice.payment_failed',
      data: { subscription: { subscription_code: 'SUB_xyz' } },
    }))
    expect(res.status).toBe(200)
    const [update] = ops('us_subscriptions', 'update')
    expect(update.args[0]).toMatchObject({ status: 'past_due' })
    const codeFilter = ops('us_subscriptions', 'eq').find((c) => c.args[0] === 'paystack_subscription_code')
    expect(codeFilter?.args[1]).toBe('SUB_xyz')
  })
})

// --------------------------------------------------------------------------
describe('POST /api/billing/webhook: unknown events', () => {
  it('acknowledges unknown events without touching the database', async () => {
    const res = await POST(makeRequest({ event: 'some.unknown.event', data: {} }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockDb.from).not.toHaveBeenCalled()
  })
})
