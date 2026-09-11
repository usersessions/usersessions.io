/**
 * Shared pipeline orchestrator, used by the webhook receivers and cron.
 *
 * Runs the full classification pipeline for a list of session IDs:
 *   pre-filter -> enrichment -> reasoning -> policy evaluation -> execution/approval routing
 *
 * MODEL ROUTING (see pricing/billing doc section 1):
 *   First pass  -> Haiku  (ANTHROPIC_HAIKU_MODEL)  for every session that clears the pre-filter
 *   Second pass -> Sonnet (ANTHROPIC_SONNET_MODEL) for P0/P1 only
 * This dual routing is the single highest-leverage cost lever; do not collapse it.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { enrichSession } from '@/services/enrichment'
import { classifySession } from '@/services/reasoning'
import { evaluatePolicies, type PolicyDecision } from '@/services/policy'
import { executeAutoActions } from '@/services/executor'
import { postApprovalRequest } from '@/services/approval'
import { normalizeAction, toolkitsFor } from '@/services/action-catalog'
import type { USClient, USSession, USEvent, USPolicyRule, USAction, FindingSignals } from '@/types/usersessions'
import { ACTION_STATUSES, FINDING_STATUSES } from '@/types/constants'

const HAIKU_MODEL = process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5'
const SONNET_MODEL = process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-5'

/** A session is classified at most once per day. Cron windows overlap, so this is required. */
const FINDING_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Source-map correlation (audit section 6) does not exist yet. Until it does, create_pr
 * is degraded to create_issue instead of pretending a 0.9 correlation confidence.
 * Flip with SOURCE_CORRELATION_ENABLED=true once services/source-correlation.ts lands.
 */
const SOURCE_CORRELATION_ENABLED = process.env.SOURCE_CORRELATION_ENABLED === 'true'

export async function runClassificationPipeline(params: {
  clientId: string
  sessionIds: string[]
}): Promise<void> {
  const supabase = createServiceClient()
  const { clientId, sessionIds } = params

  if (sessionIds.length === 0) return

  const { data: client } = await supabase
    .from('us_clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (!client) {
    console.error(`[pipeline] Client ${clientId} not found`)
    return
  }

  const { data: policyRules } = await supabase
    .from('us_policy_rules')
    .select('*')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('created_at', { ascending: true })

  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
  if (!apiKey) {
    console.error('[pipeline] ANTHROPIC_API_KEY is not set; skipping classification')
    return
  }

  const availableToolkits = computeAvailableToolkits(client as USClient)

  // Sequential on purpose (API rate limits). Batch size is bounded by the callers.
  for (const sessionId of sessionIds) {
    try {
      await classifyAndAct({
        client: client as USClient,
        sessionId,
        policyRules: (policyRules ?? []) as USPolicyRule[],
        availableToolkits,
        anthropicApiKey: apiKey,
      })
    } catch (err: any) {
      console.error(`[pipeline] Failed for session ${sessionId}:`, err?.message ?? err)
    }
  }
}

/**
 * Toolkits the model is allowed to route to for this client.
 *  - Composio apps the client connected (upper-cased slugs)
 *  - UIPATCH only after the client accepted the live-patching terms
 */
export function computeAvailableToolkits(client: USClient): string[] {
  const set = new Set<string>((client.connected_composio_apps ?? []).map((a) => String(a).toUpperCase()))
  if (client.ui_patching_terms_accepted) set.add('UIPATCH')
  return [...set]
}

/** Derive the raw signals that drove a finding from persisted session + event data. */
export function computeSignals(session: USSession, events: USEvent[]): FindingSignals {
  const rageEvents = events.filter((e) => e.type === 'rage_click')
  const errorEvents = events.filter((e) => e.type === 'error')
  const networkEvents = events.filter((e) => e.type === 'network_fail')

  // Most frequent rage-clicked element path
  const pathCounts = new Map<string, number>()
  for (const e of rageEvents) {
    const p = (e.payload as any)?.path
    if (typeof p === 'string' && p) pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1)
  }
  let elementPath: string | null = null
  let best = 0
  for (const [p, n] of pathCounts) if (n > best) { best = n; elementPath = p }

  return {
    rage_click_count: Math.max(session.rage_click_count ?? 0, rageEvents.length),
    error_count: Math.max(session.error_count ?? 0, errorEvents.length),
    network_fail_count: networkEvents.length,
    element_path: elementPath,
    page_url: session.page_url ?? null,
  }
}

/**
 * create_pr requires (a) the client granted source read and (b) a working source
 * correlation service. Without both it becomes create_issue on a connected issue
 * tracker, or is dropped if none is connected. Never silently swaps toolkits
 * the client has not connected.
 */
export function degradeCodePrDecisions(
  decisions: PolicyDecision[],
  client: USClient,
  availableToolkits: string[],
  sessionId: string,
): PolicyDecision[] {
  const out: PolicyDecision[] = []
  const seen = new Set<string>()

  for (const decision of decisions) {
    const canonical = normalizeAction(decision.action.action)
    if (canonical !== 'create_pr') {
      out.push(decision)
      continue
    }

    if (client.source_code_read_granted && SOURCE_CORRELATION_ENABLED) {
      out.push(decision)
      continue
    }

    const reason = !client.source_code_read_granted ? 'client has not granted source_code_read' : 'source correlation not enabled'
    const [fallbackToolkit] = toolkitsFor('create_issue', availableToolkits)
    if (!fallbackToolkit) {
      console.log(`[pipeline] Session ${sessionId}: dropping create_pr (${reason}; no issue tracker connected)`)
      continue
    }
    const key = `${fallbackToolkit}:create_issue`
    if (seen.has(key) || decisions.some((d) => d.action.toolkit === fallbackToolkit && normalizeAction(d.action.action) === 'create_issue')) {
      continue
    }
    seen.add(key)
    console.log(`[pipeline] Session ${sessionId}: create_pr -> ${fallbackToolkit}/create_issue (${reason})`)
    out.push({
      ...decision,
      action: {
        toolkit: fallbackToolkit,
        action: 'create_issue',
        params: { ...decision.action.params, degraded_from: 'create_pr', degraded_reason: reason },
      },
      reversible: true,
    })
  }
  return out
}

async function classifyAndAct(params: {
  client: USClient
  sessionId: string
  policyRules: USPolicyRule[]
  availableToolkits: string[]
  anthropicApiKey: string
}): Promise<void> {
  const { client, sessionId, policyRules, availableToolkits, anthropicApiKey } = params
  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('us_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!session) return
  const s = session as USSession

  // Dedupe: one finding per session per window (cron windows overlap)
  const since = new Date(Date.now() - FINDING_DEDUPE_WINDOW_MS).toISOString()
  const { data: existingFinding } = await supabase
    .from('us_findings')
    .select('id')
    .eq('session_id', sessionId)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()
  if (existingFinding) {
    console.log(`[pipeline] Session ${sessionId} already has finding ${existingFinding.id}; skipped`)
    return
  }

  const { data: eventsRaw } = await supabase
    .from('us_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('occurred_at', { ascending: true })
  const events = (eventsRaw ?? []) as USEvent[]

  // Pre-filter gate: stop early if the session has zero qualifying signals
  const signals = computeSignals(s, events)
  const hasSignal = signals.error_count > 0 || signals.rage_click_count > 0 || signals.network_fail_count > 0 ||
    events.some((e) => e.type === 'dead_click')
  if (!hasSignal) {
    console.log(`[pipeline] Session ${sessionId} has no qualifying signals; skipped (pre-filter)`)
    return
  }

  // Step 1: Enrichment
  const enrichment = await enrichSession({ client, endUserId: s.end_user_id, sessionId })

  // Step 2: Reasoning. Haiku for breadth, Sonnet only for depth on high severity.
  let reasoning = await classifySession({
    session: s,
    events,
    enrichment,
    policyRules,
    availableToolkits,
    apiKey: anthropicApiKey,
    modelOverride: HAIKU_MODEL,
    signals,
  })

  if (reasoning.severity === 'P0' || reasoning.severity === 'P1') {
    console.log(`[pipeline] Session ${sessionId} flagged ${reasoning.severity} on Haiku pass; escalating to Sonnet`)
    reasoning = await classifySession({
      session: s,
      events,
      enrichment,
      policyRules,
      availableToolkits,
      apiKey: anthropicApiKey,
      modelOverride: SONNET_MODEL,
      signals,
      priorClassification: reasoning,
    })
  }
  reasoning.signals = signals

  // Noise threshold
  if (reasoning.severity === 'P3' && reasoning.recommended_actions.length === 0 && reasoning.confidence < 0.5) {
    console.log(`[pipeline] Session ${sessionId} below noise threshold; skipped`)
    return
  }

  // Step 3: Persist Finding
  const { data: finding, error: findingErr } = await supabase
    .from('us_findings')
    .insert({
      client_id: client.id,
      session_id: sessionId,
      category: reasoning.category,
      severity: reasoning.severity,
      confidence: reasoning.confidence,
      summary: reasoning.summary,
      account_value: enrichment.arr,
      recommended_actions: reasoning.recommended_actions,
      status: FINDING_STATUSES.PENDING,
    })
    .select('id')
    .single()

  if (findingErr || !finding) {
    console.error('[pipeline] Failed to persist finding:', findingErr?.message)
    return
  }

  if (reasoning.recommended_actions.length === 0) return

  // Step 4: Policy evaluation, then honest create_pr handling
  const decisions = degradeCodePrDecisions(
    evaluatePolicies({ finding: reasoning, rules: policyRules, enrichment }),
    client,
    availableToolkits,
    sessionId,
  )
  if (decisions.length === 0) return

  // Step 5: Execute auto-level actions + queue approve_required
  const results = await executeAutoActions({
    findingId: finding.id,
    client,
    finding: reasoning,
    sessionContext: {
      replay_url: s.replay_url,
      source_session_id: s.source_session_id,
      source: s.source,
    },
    accountId: enrichment.account_id,
    decisions,
  })

  // Step 6: Post approval requests for approve_required actions
  const pendingActionIds = results
    .filter((r) => r.status === 'skipped' && r.actionId)
    .map((r) => r.actionId)

  if (pendingActionIds.length > 0) {
    const { data: pendingActions } = await supabase
      .from('us_actions')
      .select('*')
      .in('id', pendingActionIds)
      .eq('status', ACTION_STATUSES.APPROVE_REQUIRED)

    for (const pendingAction of pendingActions ?? []) {
      await postApprovalRequest({
        client,
        finding: {
          id: finding.id,
          client_id: client.id,
          session_id: sessionId,
          category: reasoning.category,
          severity: reasoning.severity,
          confidence: reasoning.confidence,
          summary: reasoning.summary,
          account_value: enrichment.arr,
          recommended_actions: reasoning.recommended_actions,
          status: FINDING_STATUSES.PENDING,
          dismissed_reason: null,
          created_at: new Date().toISOString(),
        },
        action: pendingAction as USAction,
        replayUrl: s.replay_url,
      })
    }
  }

  console.log(`[pipeline] Session ${sessionId} -> Finding ${finding.id} (${reasoning.severity} ${reasoning.category}, confidence=${reasoning.confidence})`)
}
