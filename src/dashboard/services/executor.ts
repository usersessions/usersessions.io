/**
 * Composio Execution Layer (Build Spec section 8), v3.2
 *
 * What this owns:
 *   Finding (already decided) -> write Action row -> execute via Composio -> update result
 *
 * Key invariants (never break these; billing depends on them):
 *   1. status=executed is ONLY set when result=success. Failed calls stay failed.
 *   2. Every attempt is idempotent: same finding_id + canonical action = same row, not two rows.
 *   3. Failed actions are never billed. The billing query is: status='executed' AND result='success'.
 *   4. A tool is only ever executed inside the toolkit the policy decided on. If no mapping
 *      exists the action fails; it never falls back to an unrelated tool.
 *
 * Retry policy: 3 attempts, exponential backoff (1s -> 3s -> 9s with +/-20% jitter).
 * Mapping / validation errors are not retried.
 */

import { createHash } from 'crypto'
import {
  executeComposioAction,
  resolveConnectedAccount,
  searchBestTool,
} from '@/lib/actions/composio-client'
import { createServiceClient } from '@/lib/supabase/server'
import { validatePatchPayload } from '@/lib/patches/validate'
import { composioSlugFor, normalizeAction } from '@/services/action-catalog'
import type { USClient, ReasoningOutput, ComposioToolkit, USAccount, FindingSignals } from '@/types/usersessions'
import type { PolicyDecision } from '@/services/policy'
import { ACTION_STATUSES, FINDING_STATUSES, AUTONOMY_LEVELS } from '@/types/constants'

// -- Retry config -----------------------------------------------------------------
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 1000

function backoffMs(attempt: number): number {
  const base = BASE_BACKOFF_MS * Math.pow(3, attempt)
  const jitter = base * 0.2 * (Math.random() * 2 - 1)
  return Math.round(base + jitter)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// -- Idempotency key ----------------------------------------------------------------
/** Deterministic key for a (finding, canonical action, toolkit) triple. */
export function buildIdempotencyKey(findingId: string, toolkit: string, action: string): string {
  const canonical = normalizeAction(action) ?? action.toLowerCase()
  return createHash('sha256')
    .update(`${findingId}:${toolkit.toUpperCase()}:${canonical}`)
    .digest('hex')
    .slice(0, 32)
}

// -- Client config helpers ------------------------------------------------------------

function cfg(client: USClient, key: string): string | undefined {
  const v = (client.policy_config ?? {})[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export interface SessionContext {
  replay_url: string | null
  source_session_id: string
  source: string
}

function severityLabel(finding: ReasoningOutput): string {
  return `[${finding.severity}] ${finding.summary}`
}

function describeFinding(finding: ReasoningOutput, sessionCtx: SessionContext, account: USAccount | null): string {
  const signals: Partial<FindingSignals> = finding.signals ?? {}
  const lines = [
    account?.arr ? `**Account:** ${account.domain ?? account.external_account_id} (ARR $${account.arr.toLocaleString()})` : '',
    `**Severity:** ${finding.severity} | **Confidence:** ${Math.round(finding.confidence * 100)}% | **Category:** ${finding.category}`,
    signals.rage_click_count ? `**Rage clicks:** ${signals.rage_click_count}${signals.element_path ? ` on \`${signals.element_path}\`` : ''}` : '',
    signals.error_count ? `**JS errors:** ${signals.error_count}` : '',
    signals.network_fail_count ? `**Network failures:** ${signals.network_fail_count}` : '',
    signals.page_url ? `**Page:** ${signals.page_url}` : '',
    sessionCtx.replay_url ? `**Session replay:** ${sessionCtx.replay_url}` : '',
    '',
    '---',
    '*Filed automatically by UserSessions.io*',
  ]
  return lines.filter((l) => l !== '').join('\n')
}

// -- Typed builders -------------------------------------------------------------------

export function buildIssueParams(
  toolkit: string,
  finding: ReasoningOutput,
  sessionCtx: SessionContext,
  account: USAccount | null,
  client: USClient,
  modelParams: Record<string, unknown>,
): Record<string, unknown> {
  const title = typeof modelParams.title === 'string' && modelParams.title.trim() ? modelParams.title.trim().slice(0, 250) : severityLabel(finding)
  const description = [
    typeof modelParams.description === 'string' ? modelParams.description.trim() : '',
    describeFinding(finding, sessionCtx, account),
  ].filter(Boolean).join('\n\n')
  const labels = ['usersessions', finding.category, finding.severity.toLowerCase()]
  const priority = finding.severity === 'P0' ? 'Highest' : finding.severity === 'P1' ? 'High' : 'Medium'

  switch (toolkit.toUpperCase()) {
    case 'JIRA':
      return {
        project_key: cfg(client, 'jira_project_key'),
        summary: title,
        description,
        issue_type: 'Bug',
        priority,
        labels,
      }
    case 'LINEAR':
      return {
        team_id: cfg(client, 'linear_team_id'),
        title,
        description,
        priority: finding.severity === 'P0' ? 1 : finding.severity === 'P1' ? 2 : finding.severity === 'P2' ? 3 : 4,
      }
    case 'GITHUB': {
      const [owner, repo] = (cfg(client, 'github_repo') ?? '/').split('/')
      return { owner: owner || undefined, repo: repo || undefined, title, body: description, labels }
    }
    case 'GITLAB':
      return { project_id: cfg(client, 'gitlab_project'), title, description, labels: labels.join(',') }
    default:
      return { title, description, labels }
  }
}

export function buildSlackAlertParams(
  finding: ReasoningOutput,
  sessionCtx: SessionContext,
  account: USAccount | null,
  channel: string,
  modelParams: Record<string, unknown>,
): Record<string, unknown> {
  const emoji: Record<string, string> = { bug: ':bug:', friction: ':small_red_triangle_down:', billing: ':credit_card:', security: ':lock:' }
  const replayLink = sessionCtx.replay_url ? ` | <${sessionCtx.replay_url}|View Replay>` : ''
  const accountTag = account?.domain ? ` for *${account.domain}*` : ''
  const custom = typeof modelParams.text === 'string' && modelParams.text.trim() ? `\n>${modelParams.text.trim().slice(0, 500)}` : ''

  const text = [
    `${emoji[finding.category] ?? ':warning:'} *${finding.category} detected${accountTag}* (${finding.severity})`,
    `>${finding.summary}${replayLink}`,
    `>Confidence: ${Math.round(finding.confidence * 100)}%${custom}`,
  ].join('\n')

  return { channel, text, unfurl_links: false }
}

/** Backwards-compatible alias. */
export const buildFunnelDropSlackParams = (
  finding: ReasoningOutput, sessionCtx: SessionContext, account: USAccount | null, channel: string,
) => buildSlackAlertParams(finding, sessionCtx, account, channel, {})

export function buildChurnRiskCRMParams(
  toolkit: string,
  finding: ReasoningOutput,
  account: USAccount | null,
  modelParams: Record<string, unknown>,
): Record<string, unknown> {
  const subject = `[UserSessions] ${finding.category} signal: ${finding.summary}`.slice(0, 250)
  const notes = [
    `Severity: ${finding.severity}`,
    `Confidence: ${Math.round(finding.confidence * 100)}%`,
    `Detected: ${new Date().toISOString()}`,
    '',
    typeof modelParams.note === 'string' ? modelParams.note : finding.summary,
    '',
    '---',
    'Filed automatically by UserSessions.io',
  ].join('\n')

  if (toolkit.toUpperCase() === 'SALESFORCE') {
    return {
      Subject: subject,
      Description: notes,
      Priority: finding.severity === 'P0' || finding.severity === 'P1' ? 'High' : 'Normal',
      Status: 'Not Started',
      ...(account?.external_account_id ? { WhatId: account.external_account_id } : {}),
    }
  }
  return {
    subject,
    notes,
    hs_task_type: 'TODO',
    hs_task_priority: finding.severity === 'P0' || finding.severity === 'P1' ? 'HIGH' : 'MEDIUM',
    ...(account?.external_account_id ? { associated_company_id: account.external_account_id } : {}),
  }
}

export function buildWeeklyDigestParams(findings: ReasoningOutput[], clientName: string): Record<string, unknown> {
  const date = new Date().toISOString().split('T')[0]
  const p0s = findings.filter((f) => f.severity === 'P0').length
  const p1s = findings.filter((f) => f.severity === 'P1').length
  const title = `UserSessions Weekly Digest: ${clientName} (${date})`
  const content = [
    `# ${title}`,
    '',
    `**Summary:** ${findings.length} findings this week: ${p0s} P0, ${p1s} P1`,
    '',
    '## Top Findings',
    ...findings.slice(0, 10).map((f, i) => `${i + 1}. **[${f.severity}]** ${f.summary}`),
    '',
    '---',
    '*Generated by UserSessions.io*',
  ].join('\n')
  return { title, content }
}

/** Build the Composio arguments for a decision. Builders own the required fields; model params fill the rest. */
export function buildActionParams(
  decision: PolicyDecision,
  finding: ReasoningOutput,
  sessionCtx: SessionContext,
  account: USAccount | null,
  client: USClient,
): Record<string, unknown> {
  const modelParams = (decision.action.params as Record<string, unknown>) ?? {}
  const toolkit = decision.action.toolkit
  switch (normalizeAction(decision.action.action)) {
    case 'create_issue':
      return buildIssueParams(toolkit, finding, sessionCtx, account, client, modelParams)
    case 'post_message':
      return buildSlackAlertParams(
        finding, sessionCtx, account,
        client.slack_alert_channel ?? (typeof modelParams.channel === 'string' ? modelParams.channel : '#product-alerts'),
        modelParams,
      )
    case 'flag_account':
      return buildChurnRiskCRMParams(toolkit, finding, account, modelParams)
    default:
      return modelParams
  }
}

// -- Tool resolution -----------------------------------------------------------------

/**
 * Resolve the Composio tool slug for (toolkit, action). Catalog first; a live search
 * limited to the SAME toolkit second; otherwise throw so the action fails visibly.
 */
export async function resolveComposioTool(
  entityId: string,
  toolkit: string,
  action: string,
): Promise<{ actionName: string; connectedAccountId?: string }> {
  const connectedAccountId = await resolveConnectedAccount(entityId, toolkit)
  const slug = composioSlugFor(toolkit, action)
  if (slug) return { actionName: slug, connectedAccountId }

  const search = await searchBestTool(entityId, `${toolkit} ${action}`, [toolkit])
  if (search && search.toolkit === toolkit.toLowerCase()) {
    return { actionName: search.actionName, connectedAccountId: search.connectedAccountId ?? connectedAccountId }
  }
  throw new Error(`No Composio tool mapping for ${toolkit}/${action}`)
}

// -- Shadow patch creation --------------------------------------------------------------

async function createShadowPatch(params: {
  findingId: string
  client: USClient
  actionParams: Record<string, unknown>
  signals?: FindingSignals
}): Promise<{ id: string | null; error: string | null }> {
  const { findingId, client, actionParams, signals } = params
  const supabase = createServiceClient()

  const patchType = typeof actionParams.patch_type === 'string' ? actionParams.patch_type : 'css'
  // Legacy shape: the whole params object was the payload
  const payload = (actionParams.patch_payload && typeof actionParams.patch_payload === 'object')
    ? actionParams.patch_payload
    : actionParams

  const validation = validatePatchPayload(patchType, payload)
  if (!validation.ok) return { id: null, error: `Unsafe patch payload rejected: ${validation.reason}` }

  const targetSelector = typeof actionParams.target_selector === 'string' && actionParams.target_selector.trim()
    ? actionParams.target_selector.trim()
    : signals?.element_path ?? null
  if (!targetSelector) return { id: null, error: 'UI patch has no target_selector and no rage-click element path' }

  const targetSignals = (actionParams.target_signals && typeof actionParams.target_signals === 'object')
    ? { selector: targetSelector, ...(actionParams.target_signals as Record<string, unknown>) }
    : { selector: targetSelector, ...(signals?.element_path ? { path: signals.element_path } : {}) }

  const urlPattern = typeof actionParams.url_pattern === 'string' && actionParams.url_pattern.trim()
    ? actionParams.url_pattern.trim()
    : signals?.page_url ?? null

  const { data, error } = await supabase
    .from('us_ui_patches')
    .insert({
      finding_id: findingId,
      client_id: client.id,
      target_selector: targetSelector,
      target_signals: targetSignals,
      patch_type: patchType,
      patch_payload: payload,
      url_pattern: urlPattern,
      status: 'shadow',
      canary_percentage: 5,
    })
    .select('id')
    .single()

  if (error || !data) return { id: null, error: `Failed to create shadow patch: ${error?.message ?? 'unknown'}` }
  return { id: data.id, error: null }
}

// -- Core executor -------------------------------------------------------------------

export interface ExecutionResult {
  actionId: string
  toolkit: ComposioToolkit
  composioAction: string
  status: 'executed' | 'failed' | 'skipped'
  result: 'success' | 'failed' | null
  error?: string
  attempts?: number
}

/**
 * Executes a single PolicyDecision with idempotency, retry, correct billing semantics
 * and toolkit-bound tool resolution.
 */
export async function executeAction(params: {
  findingId: string
  client: USClient
  finding: ReasoningOutput
  sessionContext: SessionContext
  accountId: string | null
  decision: PolicyDecision
  approvedBy: string   // 'auto:policy_id' for autonomous, user email for human-approved
  existingActionId?: string
  account?: USAccount | null
}): Promise<ExecutionResult> {
  const { findingId, client, finding, sessionContext, decision, approvedBy, existingActionId, account = null } = params
  const supabase = createServiceClient()

  const toolkit = decision.action.toolkit
  const composioAction = normalizeAction(decision.action.action) ?? decision.action.action
  const isPatch = toolkit === 'UIPATCH'

  if (!isPatch && !client.composio_entity_id) {
    return {
      actionId: existingActionId ?? '',
      toolkit,
      composioAction,
      status: 'failed',
      result: 'failed',
      error: 'Client has no Composio entity ID; cannot execute',
    }
  }

  // -- Idempotency check ------------------------------------------------------------
  const idempotencyKey = buildIdempotencyKey(findingId, toolkit, composioAction)

  const { data: existing } = await supabase
    .from('us_actions')
    .select('id, status, result, attempt_count')
    .eq('idempotency_key', idempotencyKey)
    .not('status', 'in', `("${ACTION_STATUSES.FAILED}","${ACTION_STATUSES.DISMISSED}")`)
    .maybeSingle()

  if (existing && existing.status === ACTION_STATUSES.EXECUTED) {
    return { actionId: existing.id, toolkit, composioAction, status: ACTION_STATUSES.EXECUTED, result: 'success' }
  }

  const actionParams = buildActionParams(decision, finding, sessionContext, account, client)

  // -- Write / update Action row ------------------------------------------------------
  let actionId: string

  if (existingActionId) {
    actionId = existingActionId
    await supabase.from('us_actions').update({ status: ACTION_STATUSES.EXECUTING, approved_by: approvedBy }).eq('id', actionId)
  } else if (existing) {
    actionId = existing.id
    await supabase.from('us_actions').update({ status: ACTION_STATUSES.EXECUTING, approved_by: approvedBy }).eq('id', actionId)
  } else {
    const { data: actionRow, error: insertErr } = await supabase
      .from('us_actions')
      .insert({
        finding_id: findingId,
        client_id: client.id,
        composio_toolkit: toolkit,
        composio_action: composioAction,
        params: actionParams,
        autonomy_level: decision.autonomy_level,
        status: ACTION_STATUSES.EXECUTING,
        reversible: decision.reversible,
        approved_by: approvedBy,
        matched_rule_id: decision.matched_rule_id,
        idempotency_key: idempotencyKey,
        attempt_count: 0,
      })
      .select('id')
      .single()

    if (insertErr || !actionRow) {
      return { actionId: '', toolkit, composioAction, status: ACTION_STATUSES.FAILED, result: 'failed', error: `DB insert failed: ${insertErr?.message}` }
    }
    actionId = actionRow.id
  }

  // -- Execute -------------------------------------------------------------------------
  let composioResult: unknown = null
  let execError: string | null = null
  let attempts = 0

  if (isPatch) {
    attempts = 1
    const patch = await createShadowPatch({ findingId, client, actionParams, signals: finding.signals })
    execError = patch.error
    composioResult = patch.id ? { status: 'shadow_created', ui_patch_id: patch.id } : null
  } else {
    let resolved: { actionName: string; connectedAccountId?: string } | null = null
    try {
      resolved = await resolveComposioTool(client.composio_entity_id!, toolkit, composioAction)
    } catch (err: any) {
      attempts = 1
      execError = err?.message ?? String(err)
    }

    if (resolved) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        attempts = attempt + 1
        try {
          composioResult = await executeComposioAction({
            entityId: client.composio_entity_id!,
            toolkit: toolkit.toLowerCase(),
            actionName: resolved.actionName,
            actionParams,
            connectedAccountId: resolved.connectedAccountId,
          })
          execError = null
          break
        } catch (err: any) {
          execError = err?.message ?? String(err)
          console.warn(`[executor] Attempt ${attempts}/${MAX_ATTEMPTS} failed for action ${actionId}:`, execError)
          await supabase.from('us_actions').update({ attempt_count: attempts, last_error: execError }).eq('id', actionId)
          if (attempt < MAX_ATTEMPTS - 1) await sleep(backoffMs(attempt))
        }
      }
    }
  }

  // -- Final result write ----------------------------------------------------------------
  const success = execError === null
  const now = new Date().toISOString()

  await supabase
    .from('us_actions')
    .update({
      status: success ? ACTION_STATUSES.EXECUTED : ACTION_STATUSES.FAILED,
      result: success ? 'success' : 'failed',
      result_detail: success ? (composioResult as Record<string, unknown>) : { error: execError, attempts },
      executed_at: success ? now : null,
      attempt_count: attempts,
      last_error: success ? null : execError,
    })
    .eq('id', actionId)

  if (!success) {
    try {
      await supabase.from('us_notification_events').insert({
        client_id: client.id,
        event_type: 'action_failed',
        payload: { action_id: actionId, finding_id: findingId, toolkit, action: composioAction, error: execError, attempts },
      })
    } catch {
      // Notification failure is non-fatal
    }
  }

  return {
    actionId,
    toolkit,
    composioAction,
    status: success ? ACTION_STATUSES.EXECUTED : ACTION_STATUSES.FAILED,
    result: success ? 'success' : 'failed',
    error: execError ?? undefined,
    attempts,
  }
}

/** Finding status derived from what actually happened, not from what was planned. */
export function deriveFindingStatus(results: ExecutionResult[]): string {
  const executed = results.filter((r) => r.status === 'executed').length
  const pending = results.filter((r) => r.status === 'skipped' && r.actionId).length
  const failed = results.filter((r) => r.status === 'failed' || (r.status === 'skipped' && !r.actionId)).length

  if (pending > 0 || (executed > 0 && failed > 0)) return FINDING_STATUSES.PARTIALLY_EXECUTED
  if (executed > 0) return FINDING_STATUSES.EXECUTED
  return FINDING_STATUSES.PENDING
}

/**
 * Execute all auto-level decisions for a Finding.
 * approve_required decisions (and every UI patch) are written as Action rows with
 * status=approve_required but NOT executed. UI patches additionally get a shadow row.
 */
export async function executeAutoActions(params: {
  findingId: string
  client: USClient
  finding: ReasoningOutput
  sessionContext: SessionContext
  accountId: string | null
  decisions: PolicyDecision[]
  account?: USAccount | null
}): Promise<ExecutionResult[]> {
  const { findingId, client, finding, sessionContext, accountId, decisions, account = null } = params
  const supabase = createServiceClient()
  const results: ExecutionResult[] = []

  for (const decision of decisions) {
    const toolkit = decision.action.toolkit
    const composioAction = normalizeAction(decision.action.action) ?? decision.action.action
    const isPatch = toolkit === 'UIPATCH'

    if (decision.autonomy_level === AUTONOMY_LEVELS.AUTO && !isPatch) {
      results.push(await executeAction({
        findingId, client, finding, sessionContext, accountId, decision, account,
        approvedBy: decision.matched_rule_id ? `auto:${decision.matched_rule_id}` : 'auto',
      }))
      continue
    }

    // approve_required: pending row (+ shadow patch for UIPATCH)
    let patchId: string | null = null
    let patchError: string | null = null
    const rawParams = (decision.action.params as Record<string, unknown>) ?? {}

    if (isPatch) {
      const patch = await createShadowPatch({ findingId, client, actionParams: rawParams, signals: finding.signals })
      patchId = patch.id
      patchError = patch.error
    }

    const idempotencyKey = buildIdempotencyKey(findingId, toolkit, composioAction)
    const { data: actionRow } = await supabase
      .from('us_actions')
      .insert({
        finding_id: findingId,
        client_id: client.id,
        composio_toolkit: toolkit,
        composio_action: composioAction,
        params: patchId ? { ...rawParams, _ui_patch_id: patchId } : rawParams,
        autonomy_level: AUTONOMY_LEVELS.APPROVE_REQUIRED,
        status: patchError ? ACTION_STATUSES.FAILED : ACTION_STATUSES.APPROVE_REQUIRED,
        result: patchError ? 'failed' : null,
        result_detail: patchError ? { error: patchError } : null,
        last_error: patchError,
        reversible: decision.reversible,
        matched_rule_id: decision.matched_rule_id,
        idempotency_key: idempotencyKey,
        attempt_count: patchError ? 1 : 0,
      })
      .select('id')
      .single()

    results.push(patchError
      ? { actionId: actionRow?.id ?? '', toolkit, composioAction, status: 'failed', result: 'failed', error: patchError }
      : { actionId: actionRow?.id ?? '', toolkit, composioAction, status: 'skipped', result: null })
  }

  await supabase
    .from('us_findings')
    .update({ status: deriveFindingStatus(results) })
    .eq('id', findingId)

  return results
}
