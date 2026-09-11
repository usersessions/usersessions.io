/**
 * useFeatureAccess — unified feature-gating hook for usersessions.io
 *
 * Accepts the user's `plan` string (from DB profiles.plan) and returns a
 * fully-typed FeatureAccess object. Derives every permission from lib/tiers
 * so there is ONE source of truth for limits.
 *
 * Usage:
 *   const access = useFeatureAccess(profile.plan)
 *   if (!access.canCustomWorkflows) showUpgradeModal('Custom Workflows')
 */

import { useMemo } from 'react'
import { PLAN_PLATFORM_CREDITS, getPlanConfig, normalizePlanId, type PlanId } from '@/lib/tiers'
import { CALCULATOR_TIERS, type CalculatorTierId } from '@/lib/documents/types'

export interface FeatureAccess {
  // ── Plan meta ────────────────────────────────────────────────
  planTier: PlanId
  planLabel: string                // "Starter" | "Pro" | "Business" | "Enterprise" | "Free"
  isAtLeastStarter: boolean
  isAtLeastPro: boolean
  isAtLeastBusiness: boolean
  isEnterprise: boolean

  // ── Legacy aliases (keep existing call-sites compiling) ──────
  /** @deprecated Use isAtLeastPro */
  isAtLeastAgency: boolean

  // ── Limits ───────────────────────────────────────────────────
  sessionsPerMonth: number
  actionsIncluded: number
  sitesIncluded: number
  monthlyCredits: number
  /** @deprecated — not applicable to this product; always 0 */
  maxBulkGeneration: number
  /** @deprecated — not applicable to this product; always 0 */
  dailyMaxGenerations: number

  // ── Feature gates ────────────────────────────────────────────
  /** Pro+: Slack real-time alerts */
  canSlackAlerts: boolean
  /** Business+: Custom remediation workflows */
  canCustomWorkflows: boolean
  /** Business+: API access */
  canApiAccess: boolean
  /** Enterprise: self-hosted deployment */
  canSelfHost: boolean

  // ── Legacy boolean gates (map to closest new equivalent) ────
  /** @deprecated → canSlackAlerts */
  canAutoPostSocial: boolean
  /** @deprecated → canSlackAlerts */
  canAutoSyncCatalog: boolean
  /** @deprecated → canCustomWorkflows */
  canUseCustomBrandVoice: boolean
  /** @deprecated → canCustomWorkflows */
  canUseCustomPrompts: boolean
  /** @deprecated → canSelfHost */
  canWhiteLabel: boolean
  /** @deprecated → always false */
  canAutoRefill: boolean
  /** @deprecated → canApiAccess */
  hasPriorityQueue: boolean

  maxTeamSeats: number
  
  mcpAccess: 'read-only' | 'read-write' | 'none'
  livePatching: 'none' | 'canary' | 'full'
  hasSSO: boolean

  // ── Upgrade messaging helpers ────────────────────────────────
  requiredPlanFor: (feature: keyof Omit<FeatureAccess, 'requiredPlanFor' | 'upgradeMessageFor'>) => 'pro' | 'business' | 'enterprise' | null
  upgradeMessageFor: (featureName: string) => string
}

const GATE_REQUIREMENTS: Partial<Record<keyof FeatureAccess, 'pro' | 'business' | 'enterprise'>> = {
  canSlackAlerts:       'pro',
  canAutoPostSocial:    'pro',
  canAutoSyncCatalog:   'pro',
  canApiAccess:         'pro',
  hasPriorityQueue:     'pro',
  canUseCustomPrompts:  'pro',
  canCustomWorkflows:   'business',
  canUseCustomBrandVoice: 'business',
  canWhiteLabel:        'enterprise',
  canSelfHost:          'enterprise',
  canAutoRefill:        'enterprise',
}

function buildAccess(plan: string | null | undefined): FeatureAccess {
  const planId: PlanId = normalizePlanId(plan)
  const config = getPlanConfig(planId)
  const { limits } = config

  const isAtLeastStarter  = planId !== 'free'
  const isAtLeastPro      = planId === 'pro' || planId === 'business' || planId === 'enterprise'
  const isAtLeastBusiness = planId === 'business' || planId === 'enterprise'
  const isEnterprise      = planId === 'enterprise'

  const requiredPlanFor: FeatureAccess['requiredPlanFor'] = (feature) =>
    GATE_REQUIREMENTS[feature] ?? null

  const upgradeMessageFor = (featureName: string): string => {
    if (!isAtLeastPro)
      return `${featureName} is available on the Pro plan ($149/mo). Upgrade to unlock Slack alerts, API access, and more.`
    if (!isAtLeastBusiness)
      return `${featureName} is available on the Business plan ($699/mo). Upgrade to unlock custom workflows, 15 sites, and 5,000 actions.`
    if (!isEnterprise)
      return `${featureName} requires the Enterprise plan. Contact us at twalib@usersessions.io.`
    return ''
  }

  const calcTierId: CalculatorTierId = 
    planId === 'free' ? 'starter' : 
    planId === 'enterprise' ? 'enterprise_license' :
    planId as CalculatorTierId
  const calcTier = CALCULATOR_TIERS[calcTierId] ?? CALCULATOR_TIERS.starter

  return {
    planTier:    planId,
    planLabel:   config.name,

    isAtLeastStarter,
    isAtLeastPro,
    isAtLeastBusiness,
    isEnterprise,
    isAtLeastAgency: isAtLeastPro,  // legacy alias

    sessionsPerMonth: calcTier.sessionsIncluded,
    actionsIncluded:  calcTier.actionsIncluded,
    sitesIncluded:    calcTier.sitesIncluded,
    monthlyCredits:   PLAN_PLATFORM_CREDITS[planId] ?? 0,
    maxBulkGeneration:   0,  // legacy shim
    dailyMaxGenerations: 0,  // legacy shim

    canSlackAlerts:        limits.slackAlerts,
    canCustomWorkflows:    limits.customWorkflows,
    canApiAccess:          limits.apiAccess,
    canSelfHost:           limits.selfHosted,

    mcpAccess:             calcTier.mcpAccess,
    livePatching:          calcTier.livePatching,
    hasSSO:                calcTier.sso,

    // Legacy gates mapped to nearest equivalent
    canAutoPostSocial:     limits.slackAlerts,
    canAutoSyncCatalog:    limits.slackAlerts,
    canUseCustomBrandVoice: limits.customWorkflows,
    canUseCustomPrompts:   limits.apiAccess,
    canWhiteLabel:         limits.selfHosted,
    canAutoRefill:         false,
    hasPriorityQueue:      limits.apiAccess,

    maxTeamSeats: calcTier.seatsIncluded,

    requiredPlanFor,
    upgradeMessageFor,
  }
}

/** Client-side hook */
export function useFeatureAccess(plan: string | null | undefined): FeatureAccess {
  return useMemo(() => buildAccess(plan), [plan])
}

/** Server-side equivalent for use in RSC / layout.tsx */
export function getFeatureAccess(plan: string | null | undefined): FeatureAccess {
  return buildAccess(plan)
}
