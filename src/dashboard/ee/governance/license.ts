/**
 * ee/governance/license.ts
 *
 * Enterprise Governance — License Gate
 *
 * This module was previously a stub that unconditionally returned false
 * for hasEnterpriseLicense(). It is now wired to lib/billing/license.ts
 * which checks both active Paystack subscriptions AND valid enterprise
 * license keys (for self-hosters) against the real us_subscriptions and
 * us_enterprise_licenses tables.
 *
 * Usage:
 *   import { hasEnterpriseLicense } from '@/ee/governance/license'
 *   const licensed = await hasEnterpriseLicense(clientId)
 */

import { requireLicenseOrSubscription } from '@/lib/billing/license'

/**
 * Returns true if the client has either:
 *  - An active Paystack subscription (Starter / Pro / Business / Enterprise), or
 *  - A valid, unexpired self-hosted enterprise license key.
 *
 * This is the single gate for all premium / EE features. Callers should
 * treat false as "redirect to upgrade" or silently degrade, never expose
 * the underlying license storage model to the UI.
 */
export async function hasEnterpriseLicense(clientId: string): Promise<boolean> {
  return requireLicenseOrSubscription(clientId)
}
