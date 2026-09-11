import { createServiceClient } from '@/lib/supabase/server'

/**
 * Validates whether a client is authorized to use closed-source modules
 * (Judgment-Gating / Action Execution and Live UI Patching).
 *
 * Authorization requires ONE of the following:
 * 1. An active Managed Cloud subscription (Starter, Pro, Business, or Enterprise) via Paystack.
 * 2. A valid, unexpired Enterprise License key (for self-hosters).
 */
export async function requireLicenseOrSubscription(clientId: string): Promise<boolean> {
  const db = createServiceClient()

  // 1. Check for active cloud subscription
  const { data: sub } = await db
    .from('us_subscriptions')
    .select('status')
    .eq('client_id', clientId)
    .in('status', ['active', 'non-renewing']) // non-renewing is still active until period end
    .maybeSingle()

  if (sub) {
    return true
  }

  // 2. Check for active enterprise license (self-hosted)
  const { data: license } = await db
    .from('us_enterprise_licenses')
    .select('status, expires_at')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (license) {
    return true
  }

  return false
}
