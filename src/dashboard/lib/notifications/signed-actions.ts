/**
 * Signed one-click action URLs for email CTAs.
 *
 * Every email that carries an action (Approve / Dismiss / Reconnect) uses a
 * short-lived HMAC-signed token so the recipient can act in one click without
 * logging in. The token is verified server-side at /api/notify/action.
 *
 * Token payload: { findingId?, actionId?, action, userId, exp }
 * Signed with: HMAC-SHA256(secret, base64url(payload))
 */

import { getStrongSecret } from '@/lib/secrets'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://usersessions.io'

/**
 * Signing secret. FAIL CLOSED: if NOTIFY_ACTION_SECRET (or the CRON_SECRET fallback)
 * is missing or a placeholder, links cannot be signed and no token verifies.
 * There is intentionally no hardcoded dev default.
 */
function getSecret(): string | null {
  return getStrongSecret('NOTIFY_ACTION_SECRET') ?? getStrongSecret('CRON_SECRET')
}

export type OneClickAction =
  | 'approve_finding'
  | 'dismiss_finding'
  | 'reconnect_integration'
  | 'view_action'
  | 'view_billing'

export interface ActionTokenPayload {
  action: OneClickAction
  userId: string
  findingId?: string
  actionId?: string
  integrationSource?: string
  exp: number // unix timestamp seconds
}

/** Encode a payload to base64url */
function toBase64Url(obj: unknown): string {
  const json = JSON.stringify(obj)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json).toString('base64url')
  }
  // Edge runtime fallback
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** Decode from base64url */
function fromBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - str.length % 4) % 4, '=')
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64url').toString('utf-8')
  }
  return atob(padded)
}

/** HMAC-SHA256 using the Web Crypto API (works in both Node 18+ and Edge runtime) */
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const bytes = new Uint8Array(sig)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacVerify(data: string, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(data, secret)
  // Constant-time comparison
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

/**
 * Create a signed one-click action URL.
 * Throws if no signing secret is configured. Callers should catch and fall back
 * to a plain dashboard link rather than emailing an unsigned action.
 * @param payload  The action to encode
 * @param expiresInHours  Token lifetime in hours (default 72h)
 */
export async function signActionUrl(
  payload: Omit<ActionTokenPayload, 'exp'>,
  expiresInHours = 72
): Promise<string> {
  const secret = getSecret()
  if (!secret) {
    throw new Error('NOTIFY_ACTION_SECRET is not configured; refusing to sign a one-click action URL')
  }
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600
  const full: ActionTokenPayload = { ...payload, exp }
  const encoded = toBase64Url(full)
  const sig = await hmacSign(encoded, secret)
  const token = `${encoded}.${sig}`
  return `${SITE}/api/notify/action?t=${encodeURIComponent(token)}`
}

/**
 * Verify and decode a one-click action token.
 * Returns null if invalid, expired, tampered, or if no secret is configured.
 */
export async function verifyActionToken(token: string): Promise<ActionTokenPayload | null> {
  try {
    const secret = getSecret()
    if (!secret) return null
    const [encoded, sig] = token.split('.')
    if (!encoded || !sig) return null
    const valid = await hmacVerify(encoded, sig, secret)
    if (!valid) return null
    const payload: ActionTokenPayload = JSON.parse(fromBase64Url(encoded))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/**
 * Build the set of action URLs for a finding email.
 * Returns { approveUrl, dismissUrl }
 */
export async function findingActionUrls(
  findingId: string,
  userId: string
): Promise<{ approveUrl: string; dismissUrl: string }> {
  const [approveUrl, dismissUrl] = await Promise.all([
    signActionUrl({ action: 'approve_finding', userId, findingId }),
    signActionUrl({ action: 'dismiss_finding', userId, findingId }),
  ])
  return { approveUrl, dismissUrl }
}

/**
 * Build the reconnect URL for an integration disconnection email.
 */
export async function integrationReconnectUrl(
  integrationSource: string,
  userId: string
): Promise<string> {
  return signActionUrl({ action: 'reconnect_integration', userId, integrationSource })
}
