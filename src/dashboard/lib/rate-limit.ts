/**
 * Sliding-window rate limiter — dependency-free abuse backstop.
 *
 * HONEST LIMITATION: state is per serverless instance and resets on cold
 * start, so the effective global limit is (limit × warm instances). That is
 * still a real brake on a runaway extension bug or a compromised token
 * hammering one endpoint. The scale follow-up is a shared store
 * (Upstash/Redis or a Postgres counter) behind this same function signature.
 */
const buckets = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  // Opportunistic cleanup so the map never grows unbounded.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}
