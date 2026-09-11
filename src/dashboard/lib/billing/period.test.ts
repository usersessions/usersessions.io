import { describe, it, expect } from 'vitest'
import { periodEndFrom } from './period'

const NOW = Date.parse('2026-09-01T00:00:00Z')

describe('periodEndFrom', () => {
  it('uses Paystack next_payment_date when present and in the future', () => {
    expect(periodEndFrom('2027-09-01T00:00:00.000Z', NOW)).toBe('2027-09-01T00:00:00.000Z')
  })

  it('falls back to +30 days when missing, unparseable or in the past', () => {
    const fallback = new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(periodEndFrom(undefined, NOW)).toBe(fallback)
    expect(periodEndFrom('not a date', NOW)).toBe(fallback)
    expect(periodEndFrom('2020-01-01T00:00:00Z', NOW)).toBe(fallback)
  })
})
