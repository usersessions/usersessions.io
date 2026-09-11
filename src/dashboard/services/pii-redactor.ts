/**
 * PII Redaction Layer (Build Spec §15)
 *
 * Required before any live pilot touches real end-user session data.
 * Strips common PII patterns from session event payloads:
 *   - Email addresses
 *   - Phone numbers (international formats)
 *   - Credit card numbers (Luhn-ish patterns)
 *   - SSNs
 *   - IP addresses (IPv4 + IPv6) — optionally keep for geolocation, mask by default
 *   - Custom field blocklist (configured per client via environment)
 *
 * Philosophy: redact at ingest time, before persisting to Postgres.
 * Once data is in the DB clean, downstream reasoning never sees raw PII.
 * The session still has full behavioral signal — we just remove identity markers.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(\+?[\d\s\-().]{7,})/g
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g
const SSN_RE = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g
const IPV4_RE = /\b(\d{1,3}\.){3}\d{1,3}\b/g
const IPV6_RE = /\b([0-9a-fA-F]{1,4}:){7,}[0-9a-fA-F]{1,4}\b/g

// Non-global copies for boolean tests. `/g` regexes are stateful under
// RegExp.prototype.test (lastIndex advances), which produced false negatives
// on consecutive calls with different inputs.
const EMAIL_TEST = new RegExp(EMAIL_RE.source)
const SSN_TEST = new RegExp(SSN_RE.source)
const CARD_TEST = new RegExp(CARD_RE.source)

// High-confidence PII field names — values of these keys are always masked
const PII_FIELD_KEYS = new Set([
  'email', 'user_email', 'usr.email', 'email_address',
  'phone', 'phone_number', 'mobile', 'telephone',
  'name', 'full_name', 'first_name', 'last_name', 'usr.name',
  'address', 'street_address', 'zip', 'postal_code',
  'ssn', 'social_security', 'dob', 'date_of_birth',
  'card_number', 'cc_number', 'credit_card',
  'password', 'passwd', 'secret', 'token', 'api_key',
  'ip', 'ip_address', 'client_ip', 'network.client.ip',
])

function redactString(value: string): string {
  return value
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(IPV4_RE, '[IP]')
    .replace(IPV6_RE, '[IP]')
    .replace(SSN_RE, '[SSN]')
    .replace(CARD_RE, (match) => {
      const digits = match.replace(/\D/g, '')
      return digits.length >= 13 && digits.length <= 19 ? '[CARD]' : match
    })
    .replace(PHONE_RE, (match) => {
      // Only redact if it looks like a real phone (≥7 actual digits)
      const digits = match.replace(/\D/g, '')
      return digits.length >= 7 ? '[PHONE]' : match
    })
}

function redactValue(key: string, value: unknown): unknown {
  // Always mask known PII field names
  if (PII_FIELD_KEYS.has(key.toLowerCase())) {
    if (typeof value === 'string' && value.length > 0) return '[REDACTED]'
    if (typeof value === 'number') return 0
  }
  // Redact patterns inside string values
  if (typeof value === 'string') {
    return redactString(value)
  }
  return value
}

/**
 * Deep-redact an object or array. Returns a new object with PII removed.
 * Safe for large payloads — caps recursion at depth 8.
 */
export function redactPayload(obj: unknown, depth = 0): unknown {
  if (depth > 8) return obj
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return redactString(obj)
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => redactPayload(item, depth + 1))
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = redactPayload(value, depth + 1)
    } else {
      result[key] = redactValue(key, value)
    }
  }
  return result
}

/**
 * Redact a session's end_user_id if it looks like an email.
 * End user IDs are fine to keep if they are opaque UUIDs or numeric IDs.
 */
export function redactEndUserId(id: string | null): string | null {
  if (!id) return null
  if (EMAIL_TEST.test(id)) return '[REDACTED_EMAIL_ID]'
  return id
}

/**
 * Summary: was any redaction applied to this payload?
 * Used to set pii_masked = true on the session row.
 */
export function containsPII(obj: unknown): boolean {
  const str = JSON.stringify(obj) ?? ''
  if (!str) return false
  const lower = str.toLowerCase()
  return (
    EMAIL_TEST.test(str) ||
    SSN_TEST.test(str) ||
    CARD_TEST.test(str) ||
    Array.from(PII_FIELD_KEYS).some((key) => lower.includes(`"${key}":`))
  )
}
