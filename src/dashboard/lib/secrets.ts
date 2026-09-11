/**
 * Secret hygiene helpers.
 *
 * A secret is only usable if it is present AND does not look like a placeholder
 * copied from .env.example. Every consumer MUST fail closed when this returns null.
 * This exists because a deployed CRON_SECRET of "generate-a-secure-random-string"
 * is indistinguishable from "no auth at all".
 */

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^generate-/i,
  /change-?me/i,
  /^your-/i,
  /^replace/i,
  /^todo/i,
  /^xxx+$/i,
  /placeholder/i,
  /^dev-secret/i,
  /^secret$/i,
  /^changeme$/i,
]

/** Minimum length for an HMAC / bearer secret. 24 chars of a random base64 string is ~144 bits. */
export const MIN_SECRET_LENGTH = 24

export function isPlaceholderSecret(value: string | undefined | null): boolean {
  if (!value) return true
  const v = value.trim()
  if (v.length < MIN_SECRET_LENGTH) return true
  return PLACEHOLDER_PATTERNS.some((re) => re.test(v))
}

/**
 * Returns the env var value if it is a real secret, otherwise null.
 * Logs so a misconfigured deploy is visible in Worker logs.
 */
export function getStrongSecret(name: string): string | null {
  const v = process.env[name]
  if (isPlaceholderSecret(v)) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[secrets] ${name} is missing or a placeholder; dependent endpoints fail closed`)
    }
    return null
  }
  return v!.trim()
}

/** Constant-time string comparison for bearer tokens / HMAC hex digests. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
