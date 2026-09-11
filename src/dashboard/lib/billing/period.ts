const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Paystack sends `next_payment_date` on subscription events. Use it; only fall back
 * to now+30d when it is absent, unparseable or in the past (annual plans were
 * previously recorded as expiring after one month).
 */
export function periodEndFrom(nextPaymentDate: unknown, now: number = Date.now()): string {
  if (typeof nextPaymentDate === 'string') {
    const t = Date.parse(nextPaymentDate)
    if (Number.isFinite(t) && t > now) return new Date(t).toISOString()
  }
  return new Date(now + THIRTY_DAYS_MS).toISOString()
}
