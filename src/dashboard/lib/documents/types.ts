/**
 * UserSessions.io — Document System Types
 * Part B of the Billing Calculator & Client Document System spec.
 */

export type DocType =
  | 'invoice'
  | 'receipt'
  | 'mbr'
  | 'security_soc2'
  | 'security_dpa'
  | 'security_faq'
  | 'audit_log_export'
  | 'failed_payment_notice'
  | 'renewal_reminder'

export interface Document {
  id: string
  client_id: string | null
  doc_type: DocType
  period_start: string | null   // ISO date string
  period_end: string | null
  storage_path: string | null   // Supabase Storage path
  external_url: string | null   // External PDF URL (Paystack, etc.)
  doc_version: string | null
  sent_at: string | null
  sent_to: string[]
  metadata: Record<string, unknown>
  created_at: string
}

export interface DocumentMeta {
  /** For invoices / receipts: the Paystack invoice or charge ID */
  paystack_id?: string
  /** For MBRs: the metrics snapshot used to generate the report */
  mbr_metrics?: MBRMetrics
  /** For security bundles: the version of each file served */
  security_versions?: Record<string, string>
}

/** Metrics snapshot stored in us_documents.metadata for every MBR */
export interface MBRMetrics {
  period_label: string          // "July 2026"
  findings_total: number
  findings_by_severity: Record<'P0' | 'P1' | 'P2' | 'P3', number>
  actions_executed: number
  actions_by_toolkit: Record<string, number>
  actions_auto_executed: number
  actions_human_approved: number
  arr_at_risk_usd: number
  prev_period_findings?: number
  prev_period_actions?: number
}

/**
 * Tier config for the pricing calculator — client-facing only.
 * This is the SINGLE SOURCE OF TRUTH for all tier definitions.
 * Import from here in: PricingCalculator, CheckoutModal, billing/checkout/route.ts, pricing/page.tsx
 * Do NOT hardcode tier numbers anywhere else.
 *
 * Rates updated August 2026 to reflect final pricing.
 */
export type CalculatorTierId = 'starter' | 'pro' | 'business' | 'enterprise_license' | 'enterprise_managed'

export interface CalculatorTier {
  id: CalculatorTierId
  label: string
  base: number              // Monthly base fee USD (annual / 12 for enterprise_license)
  sessionsIncluded: number  // Infinity for enterprise (custom)
  actionsIncluded: number   // Infinity for self-hosted tiers
  overage: number           // Per-action USD overage; 0 for non-metered tiers
  sitesIncluded: number     // Infinity for enterprise (custom)
  seatsIncluded: number     // Team seats; Infinity for enterprise
  selfServe: boolean        // True = instant Paystack Pop; False = sales/invoice flow
  mcpAccess: 'read-only' | 'read-write' | 'none'
  livePatching: 'none' | 'canary' | 'full'
  sso: boolean
  supportTier: 'community' | 'email' | 'priority' | 'dedicated'
}

export const CALCULATOR_TIERS: Record<CalculatorTierId, CalculatorTier> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    base: 29,
    sessionsIncluded: 10_000,
    actionsIncluded: 100,
    // Composio base ~$0.0035/action; retail overage reflects margin over COGS
    overage: 0.05,
    sitesIncluded: 1,
    seatsIncluded: 1,
    selfServe: true,
    mcpAccess: 'read-only',
    livePatching: 'none',
    sso: false,
    supportTier: 'community',
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    base: 149,
    sessionsIncluded: 50_000,
    actionsIncluded: 1_000,
    overage: 0.02,
    sitesIncluded: 5,
    seatsIncluded: 5,
    selfServe: true,
    mcpAccess: 'read-write',
    livePatching: 'canary',
    sso: false,
    supportTier: 'email',
  },
  business: {
    id: 'business',
    label: 'Business',
    base: 699,
    sessionsIncluded: 250_000,
    actionsIncluded: 5_000,
    overage: 0.01,
    sitesIncluded: 15,
    seatsIncluded: 10,
    selfServe: true,
    mcpAccess: 'read-write',
    livePatching: 'full',
    sso: false,
    supportTier: 'priority',
  },
  enterprise_license: {
    id: 'enterprise_license',
    label: 'Enterprise License',
    base: Math.round(30000 / 12),  // ~$2,500/mo equivalent; paid annually at $30K
    sessionsIncluded: Infinity,    // Self-hosted, no session limit
    actionsIncluded: Infinity,     // BYO Composio, not metered by UserSessions
    overage: 0,
    sitesIncluded: Infinity,
    seatsIncluded: Infinity,
    selfServe: true,               // Can pay by card OR invoice
    mcpAccess: 'read-write',
    livePatching: 'full',
    sso: true,
    supportTier: 'dedicated',
  },
  enterprise_managed: {
    id: 'enterprise_managed',
    label: 'Enterprise Managed',
    base: 13500,                   // Midpoint of $12K–$15K range
    sessionsIncluded: Infinity,
    actionsIncluded: Infinity,
    overage: 0,
    sitesIncluded: Infinity,
    seatsIncluded: Infinity,
    selfServe: false,              // Sales-assisted only
    mcpAccess: 'read-write',
    livePatching: 'full',
    sso: true,
    supportTier: 'dedicated',
  },
}

/** Manual labor cost range from Pricing doc §4 (client-facing framing only) */
export const MANUAL_LABOR_RANGE = { low: 12, high: 25, midpoint: 18.5 } as const
