/**
 * UserSessions.io Plan Configuration — source of truth for billing tiers.
 *
 * Plan IDs map to Paystack plan codes via env vars.
 * Updated August 2026 to reflect the live Starter / Pro / Business / Enterprise pricing.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise'

export interface PlanConfig {
  id: PlanId
  name: string
  tagline: string
  price: {
    monthly: number    // USD cents
    annual: number     // USD cents (billed annually)
    annualDiscount: string
  }
  limits: {
    sessionsPerMonth: number    // Infinity = unlimited
    actionsIncluded: number     // Autonomous actions/month
    overagePerAction: number    // USD cents per overage action
    sitesIncluded: number       // Tracked domains
    teamSeats: number
    selfHosted: boolean
    apiAccess: boolean
    slackAlerts: boolean
    customWorkflows: boolean
  }
  features: string[]
  cta: string
  popular?: boolean
}

// ==========================================================
// PLAN DEFINITIONS — mirrors CALCULATOR_TIERS in lib/documents/types.ts
// ==========================================================

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'No active subscription',
    price: { monthly: 0, annual: 0, annualDiscount: '' },
    limits: {
      sessionsPerMonth: 0,
      actionsIncluded: 0,
      overagePerAction: 0,
      sitesIncluded: 0,
      teamSeats: 1,
      selfHosted: false,
      apiAccess: false,
      slackAlerts: false,
      customWorkflows: false,
    },
    features: [],
    cta: 'Upgrade',
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'Watch sessions, catch friction before it becomes churn',
    price: {
      monthly: 2900,       // $29/mo
      annual: 27840,       // $2,784/yr ≈ $232/mo (save 20%)
      annualDiscount: 'Save 20%',
    },
    limits: {
      sessionsPerMonth: 10_000,
      actionsIncluded: 100,
      overagePerAction: 5,    // $0.05
      sitesIncluded: 1,
      teamSeats: 1,
      selfHosted: false,
      apiAccess: false,
      slackAlerts: false,
      customWorkflows: false,
    },
    features: [
      'Up to 10,000 sessions / month',
      '100 automated actions included',
      '$0.05 / action thereafter',
      '1 tracked site',
      '1 team seat',
      'Session replay + heatmaps',
      'Daily friction digest',
    ],
    cta: 'Start free trial',
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Fix friction autonomously across your entire funnel',
    price: {
      monthly: 14900,      // $149/mo
      annual: 143040,      // $143,040/yr ≈ $119/mo (save 20%)
      annualDiscount: 'Save 20%',
    },
    limits: {
      sessionsPerMonth: 50_000,
      actionsIncluded: 1_000,
      overagePerAction: 2,    // $0.02
      sitesIncluded: 5,
      teamSeats: 5,
      selfHosted: false,
      apiAccess: true,
      slackAlerts: true,
      customWorkflows: false,
    },
    features: [
      'Up to 50,000 sessions / month',
      '1,000 automated actions included',
      '$0.02 / action thereafter',
      'Up to 5 tracked sites',
      '5 team seats',
      'Everything in Starter, plus:',
      'Real-time Slack alerting',
      'Jira / Linear ticket creation',
      'Revenue leakage metrics',
      'API access',
    ],
    cta: 'Get Pro',
    popular: true,
  },

  business: {
    id: 'business',
    name: 'Business',
    tagline: 'Scale autonomous remediation across your entire organisation',
    price: {
      monthly: 69900,      // $699/mo
      annual: 671040,      // $671,040/yr ≈ $559/mo (save 20%)
      annualDiscount: 'Save 20%',
    },
    limits: {
      sessionsPerMonth: 250_000,
      actionsIncluded: 5_000,
      overagePerAction: 1,    // $0.01
      sitesIncluded: 15,
      teamSeats: 10,
      selfHosted: false,
      apiAccess: true,
      slackAlerts: true,
      customWorkflows: true,
    },
    features: [
      'Up to 250,000 sessions / month',
      '5,000 automated actions included',
      '$0.01 / action thereafter',
      'Up to 15 tracked sites',
      '10 team seats',
      'Everything in Pro, plus:',
      'Custom remediation workflows',
      'Salesforce integration',
      'Priority support',
    ],
    cta: 'Get Business',
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Mission-critical session intelligence at scale — self-hosted or fully managed',
    price: {
      monthly: 0,   // Custom / billed annually
      annual: 0,
      annualDiscount: '',
    },
    limits: {
      sessionsPerMonth: Infinity,
      actionsIncluded: Infinity,
      overagePerAction: 0,
      sitesIncluded: Infinity,
      teamSeats: Infinity,
      selfHosted: true,
      apiAccess: true,
      slackAlerts: true,
      customWorkflows: true,
    },
    features: [
      'Unlimited sessions',
      'Unlimited actions (BYO Composio)',
      'Unlimited sites',
      'Unlimited team seats',
      'Self-hosted option ($30K/yr flat)',
      'Managed option (custom pricing)',
      'Dedicated Slack channel',
      'Custom SLA & compliance docs',
    ],
    cta: 'Contact Sales',
  },
}

// Plan display order for billing UI
export const PLAN_ORDER: PlanId[] = ['free', 'starter', 'pro', 'business', 'enterprise']

// ==========================================================
// HELPERS
// ==========================================================

export function getPlanConfig(planId: string | null | undefined): PlanConfig {
  return PLANS[(planId as PlanId) ?? 'free'] ?? PLANS.free
}

export function getPlanPrice(planId: string | null | undefined, billingCycle: 'monthly' | 'annual'): number {
  return getPlanConfig(planId).price[billingCycle] ?? 0
}

// ==========================================================
// LEGACY SHIMS — keep these so existing callers don't break
// while we migrate.
// ==========================================================
export type LegacyPlanId = PlanId | 'audit' | 'standard'

/** Maps old audit/standard plan IDs to new ones. */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  if (!raw) return 'free'
  if (raw === 'audit') return 'starter'
  if (raw === 'standard') return 'pro'
  return (PLANS[raw as PlanId] ? raw : 'free') as PlanId
}

// ==========================================================
// PAYSTACK PLAN CODES (env-driven)
// ==========================================================
export type PaidPlanKey =
  | 'starter_monthly'
  | 'starter_annual'
  | 'pro_monthly'
  | 'pro_annual'
  | 'business_monthly'
  | 'business_annual'

const PLAN_ENV: Record<PaidPlanKey, string> = {
  starter_monthly:  'PAYSTACK_PLAN_STARTER_MONTHLY',
  starter_annual:   'PAYSTACK_PLAN_STARTER_ANNUAL',
  pro_monthly:      'PAYSTACK_PLAN_PRO_MONTHLY',
  pro_annual:       'PAYSTACK_PLAN_PRO_ANNUAL',
  business_monthly: 'PAYSTACK_PLAN_BUSINESS_MONTHLY',
  business_annual:  'PAYSTACK_PLAN_BUSINESS_ANNUAL',
}

export function planEnvCode(key: PaidPlanKey): string | null {
  return process.env[PLAN_ENV[key]] ?? null
}

/** Paystack checkout links — only populated once plan codes are set in env */
export const PAYSTACK_CHECKOUT: Partial<Record<PlanId, string>> = {
  starter:  process.env.PAYSTACK_PLAN_STARTER_MONTHLY
    ? `https://paystack.com/pay/${process.env.PAYSTACK_PLAN_STARTER_MONTHLY}`
    : 'https://paystack.com/pay/usersessions-starter',
  pro:      process.env.PAYSTACK_PLAN_PRO_MONTHLY
    ? `https://paystack.com/pay/${process.env.PAYSTACK_PLAN_PRO_MONTHLY}`
    : 'https://paystack.com/pay/usersessions-pro',
  business: process.env.PAYSTACK_PLAN_BUSINESS_MONTHLY
    ? `https://paystack.com/pay/${process.env.PAYSTACK_PLAN_BUSINESS_MONTHLY}`
    : 'https://paystack.com/pay/usersessions-business',
}

// ==========================================================
// LEGACY COMPATIBILITY — keep existing callers working
// ==========================================================
export const PLAN_PLATFORM_CREDITS: Record<string, number> = {
  free: 0, starter: 0, pro: 0, business: 0, enterprise: 0,
  audit: 0, standard: 0,
}

export function limitsFor(planId: string | null | undefined) {
  const plan = getPlanConfig(normalizePlanId(planId))
  return {
    actionsIncluded: plan.limits.actionsIncluded,
  }
}

export function analyzePlanProfitability(planId: PlanId) {
  const plan = getPlanConfig(planId)
  const revenue = plan.price.monthly / 100
  return {
    revenuePerMonth: revenue,
    maxCostPerMonth: 0,
    minProfitPerMonth: revenue,
    marginPercent: revenue > 0 ? 100 : 0,
    breakEvenCredits: 0,
    revenuePerCredit: 0,
    maxCostPerCredit: 0,
  }
}
