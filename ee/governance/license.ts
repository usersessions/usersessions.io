/**
 * Open-Core Feature Gating (EE boundary)
 *
 * The real gate lives in the dashboard package:
 *   src/dashboard/ee/governance/license.ts -> lib/billing/license.ts
 * and checks us_subscriptions (active/non-renewing) and us_enterprise_licenses
 * (active, unexpired). This root module only re-exports it so that nothing
 * outside the dashboard can accidentally ship the old `return false` stub.
 */
export { hasEnterpriseLicense } from '../../src/dashboard/ee/governance/license'
