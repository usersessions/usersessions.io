import { describe, it, expect } from 'vitest'
import { evaluatePolicies, meetsPrecisionThresholds } from './policy'
import type { ReasoningOutput, USPolicyRule, EnrichmentContext } from '@/types/usersessions'

const enrichment: EnrichmentContext = {
  account_id: null, arr: 20_000, health_score: null, csm_owner: null, plan_tier: null, open_tickets: 0,
}

function finding(overrides: Partial<ReasoningOutput> = {}): ReasoningOutput {
  return {
    category: 'bug',
    severity: 'P2',
    confidence: 0.9,
    summary: 'Checkout button throws TypeError',
    recommended_actions: [{ toolkit: 'SLACK', action: 'post_message', params: {} }],
    signals: { rage_click_count: 0, error_count: 3, network_fail_count: 0, element_path: null },
    ...overrides,
  }
}

describe('policy autonomy gate', () => {
  it('auto-executes a confident, reversible bug alert', () => {
    const [d] = evaluatePolicies({ finding: finding(), rules: [], enrichment })
    expect(d.autonomy_level).toBe('auto')
    expect(d.reversible).toBe(true)
  })

  it('requires approval below the confidence gate', () => {
    const [d] = evaluatePolicies({ finding: finding({ confidence: 0.8 }), rules: [], enrichment })
    expect(d.autonomy_level).toBe('approve_required')
  })

  it('uses real rage-click signals for friction thresholds', () => {
    const few = finding({ category: 'friction', signals: { rage_click_count: 2, error_count: 0, network_fail_count: 0, element_path: 'button#buy' } })
    const many = finding({ category: 'friction', signals: { rage_click_count: 7, error_count: 0, network_fail_count: 0, element_path: 'button#buy' } })
    expect(meetsPrecisionThresholds(few)).toBe(false)
    expect(meetsPrecisionThresholds(many)).toBe(true)
    expect(evaluatePolicies({ finding: few, rules: [], enrichment })[0].autonomy_level).toBe('approve_required')
    expect(evaluatePolicies({ finding: many, rules: [], enrichment })[0].autonomy_level).toBe('auto')
  })

  it('treats missing signals as zero (blocks auto)', () => {
    const f = finding({ category: 'friction', signals: undefined })
    expect(meetsPrecisionThresholds(f)).toBe(false)
  })

  it('never auto-executes UI patches or PRs, even under a permissive client rule', () => {
    const rule: USPolicyRule = {
      id: 'r1', client_id: 'c1', name: 'yolo', condition: {}, autonomy_level: 'auto', active: true, created_at: '',
      action_template: { toolkit: 'UIPATCH', action: 'create_ui_patch', params_template: {} },
    }
    const f = finding({
      recommended_actions: [
        { toolkit: 'UIPATCH', action: 'create_ui_patch', params: {} },
        { toolkit: 'GITHUB', action: 'create_pr', params: {} },
        { toolkit: 'SLACK', action: 'post_message', params: {} },
      ],
    })
    const decisions = evaluatePolicies({ finding: f, rules: [rule], enrichment })
    expect(decisions.map((d) => d.autonomy_level)).toEqual(['approve_required', 'approve_required', 'auto'])
    expect(decisions[2].matched_rule_id).toBe('r1')
  })

  it('billing findings and high-ARR P0s always require approval', () => {
    expect(evaluatePolicies({ finding: finding({ category: 'billing', confidence: 0.99 }), rules: [], enrichment })[0].autonomy_level).toBe('approve_required')
    expect(evaluatePolicies({ finding: finding({ severity: 'P0', confidence: 0.99 }), rules: [], enrichment: { ...enrichment, arr: 80_000 } })[0].autonomy_level).toBe('approve_required')
  })

  it('legacy action names are recognised as reversible', () => {
    const f = finding({ recommended_actions: [{ toolkit: 'JIRA', action: 'CREATE_TICKET', params: {} }] })
    const [d] = evaluatePolicies({ finding: f, rules: [], enrichment })
    expect(d.reversible).toBe(true)
    expect(d.autonomy_level).toBe('auto')
  })
})
