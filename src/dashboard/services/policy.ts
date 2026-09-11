/**
 * Policy engine (Build Spec section 7 autonomy gate + section 9 rule evaluation)
 *
 * Takes a Finding (from the reasoning layer) and a client's PolicyRules and decides:
 *   1. Which recommended actions to execute
 *   2. The autonomy level for each action (auto vs approve_required)
 *
 * Default autonomy gate:
 *   confidence >= 0.85 AND action is reversible (Slack post, CRM tag, issue creation)
 *   -> auto-execute
 *   Anything customer-facing, billing-related, a UI patch or a code PR
 *   -> approve_required regardless of confidence.
 *
 * Client PolicyRules override the default for specific (category, severity, ARR) combos,
 * but can never bypass the hard approval list.
 */

import type {
  ReasoningOutput,
  USPolicyRule,
  RecommendedAction,
  AutonomyLevel,
  EnrichmentContext,
} from '@/types/usersessions'
import { AUTONOMY_LEVELS } from '@/types/constants'
import { isReversibleAction, neverAuto } from '@/services/action-catalog'

// -- Hard approval list ---------------------------------------------------------
// These are NEVER auto-executed regardless of confidence or client rules.
export const ALWAYS_REQUIRES_APPROVAL = new Set([
  'send_email',         // customer-facing
  'create_invoice',     // billing-related
  'update_billing',     // billing-related
  'delete_account',     // destructive
  'page_oncall',        // PagerDuty (Phase 3)
])

function requiresApprovalAlways(action: RecommendedAction): boolean {
  return ALWAYS_REQUIRES_APPROVAL.has(action.action) || neverAuto(action.action) || action.toolkit === 'UIPATCH'
}

// -- Precision thresholds -------------------------------------------------------
// Defaults enforced before any auto-execute fires.
// Per-client overrides live in PolicyRule.precision_thresholds.

export interface PrecisionThresholds {
  min_confidence?: number   // 0-1
  min_rage_clicks?: number  // friction only
  min_drop_pct?: number     // funnel only
}

const DEFAULT_THRESHOLDS: Record<string, PrecisionThresholds> = {
  bug:      { min_confidence: 0.80 },
  friction: { min_confidence: 0.80, min_rage_clicks: 5 },
  billing:  { min_confidence: 0.85 },
  security: { min_confidence: 0.85 },
  funnel:   { min_confidence: 0.75, min_drop_pct: 15 },
}

/**
 * Returns true if the finding meets all precision thresholds.
 * Signals come from `finding.signals` (populated by the pipeline from real
 * session/event data). Missing signals count as zero, which blocks auto-execute.
 */
export function meetsPrecisionThresholds(
  finding: ReasoningOutput,
  overrides?: PrecisionThresholds | null,
): boolean {
  const defaults = DEFAULT_THRESHOLDS[finding.category] ?? {}
  const thresholds: PrecisionThresholds = { ...defaults, ...(overrides ?? {}) }

  if (thresholds.min_confidence != null && finding.confidence < thresholds.min_confidence) return false

  const rageClicks = finding.signals?.rage_click_count ?? 0
  if (thresholds.min_rage_clicks != null && rageClicks < thresholds.min_rage_clicks) return false

  const dropPct = finding.signals?.funnel_drop_pct ?? 0
  if (thresholds.min_drop_pct != null && dropPct < thresholds.min_drop_pct) return false

  return true
}

// -- Policy rule matching -------------------------------------------------------

/** First matching active rule wins. Clients order rules from most to least specific. */
function matchPolicyRule(
  finding: ReasoningOutput,
  rules: USPolicyRule[],
  enrichment: EnrichmentContext,
): USPolicyRule | null {
  for (const rule of rules) {
    if (!rule.active) continue
    const c = rule.condition ?? {}

    if (c.category && c.category !== finding.category) continue
    if (c.severity && c.severity !== finding.severity) continue
    if (c.arr_gte != null && (enrichment.arr ?? 0) < c.arr_gte) continue
    if (c.arr_lt != null && (enrichment.arr ?? Infinity) >= c.arr_lt) continue

    return rule
  }
  return null
}

// -- Default autonomy gate ------------------------------------------------------

function defaultAutonomyLevel(
  action: RecommendedAction,
  finding: ReasoningOutput,
  enrichment: EnrichmentContext,
  precisionOverrides?: PrecisionThresholds | null,
): AutonomyLevel {
  if (requiresApprovalAlways(action)) return AUTONOMY_LEVELS.APPROVE_REQUIRED
  if (!meetsPrecisionThresholds(finding, precisionOverrides)) return AUTONOMY_LEVELS.APPROVE_REQUIRED
  if (finding.confidence < 0.85) return AUTONOMY_LEVELS.APPROVE_REQUIRED
  if (!isReversibleAction(action.action)) return AUTONOMY_LEVELS.APPROVE_REQUIRED
  if (finding.category === 'billing') return AUTONOMY_LEVELS.APPROVE_REQUIRED
  // High-ARR P0: one mistake is expensive, always approve
  if (finding.severity === 'P0' && (enrichment.arr ?? 0) >= 50_000) return AUTONOMY_LEVELS.APPROVE_REQUIRED
  return AUTONOMY_LEVELS.AUTO
}

// -- Output ---------------------------------------------------------------------

export interface PolicyDecision {
  action: RecommendedAction
  autonomy_level: AutonomyLevel
  reversible: boolean
  matched_rule_id: string | null
}

/**
 * Evaluates the reasoning output against the client's policy rules and returns
 * one PolicyDecision per recommended action.
 */
export function evaluatePolicies(params: {
  finding: ReasoningOutput
  rules: USPolicyRule[]
  enrichment: EnrichmentContext
}): PolicyDecision[] {
  const { finding, rules, enrichment } = params

  if (finding.recommended_actions.length === 0) return []

  const matchedRule = matchPolicyRule(finding, rules, enrichment)
  const precisionOverrides = (matchedRule?.precision_thresholds ?? undefined) as PrecisionThresholds | undefined

  return finding.recommended_actions.map((action): PolicyDecision => {
    let autonomy: AutonomyLevel
    let matchedRuleId: string | null = null

    if (matchedRule) {
      // Client rule overrides the default gate, but never the hard list or precision thresholds
      const blocked = requiresApprovalAlways(action) || !meetsPrecisionThresholds(finding, precisionOverrides)
      autonomy = blocked ? AUTONOMY_LEVELS.APPROVE_REQUIRED : matchedRule.autonomy_level
      matchedRuleId = matchedRule.id
    } else {
      autonomy = defaultAutonomyLevel(action, finding, enrichment, precisionOverrides)
    }

    return {
      action,
      autonomy_level: autonomy,
      reversible: isReversibleAction(action.action),
      matched_rule_id: matchedRuleId,
    }
  })
}
