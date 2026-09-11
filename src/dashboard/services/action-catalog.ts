/**
 * Canonical action catalog.
 *
 * The single vocabulary shared by the reasoning layer (what the model may emit),
 * the policy engine (what is reversible / needs approval) and the executor (which
 * Composio tool slug to call). Before this file existed each layer used different
 * strings (`post_message` vs `CREATE_TICKET` vs `SLACK_POST_MESSAGE`), so the
 * reversibility check never matched and auto-execution was effectively dead.
 */

import type { ComposioToolkit } from '@/types/usersessions'

export const CANONICAL_ACTIONS = [
  'post_message',    // Slack alert
  'create_issue',    // Jira / Linear / GitHub / GitLab issue
  'flag_account',    // Salesforce / HubSpot CS task
  'create_ui_patch', // shadow UI patch (never auto)
  'create_pr',       // code PR / MR (never auto; needs source correlation)
] as const

export type CanonicalAction = typeof CANONICAL_ACTIONS[number]

/** Which toolkits can carry which action. */
export const ACTION_TOOLKITS: Record<CanonicalAction, readonly ComposioToolkit[]> = {
  post_message:    ['SLACK'],
  create_issue:    ['JIRA', 'LINEAR', 'GITHUB', 'GITLAB'],
  flag_account:    ['SALESFORCE', 'HUBSPOT'],
  create_ui_patch: ['UIPATCH'],
  create_pr:       ['GITHUB', 'GITLAB'],
}

/** Reversible = safe for auto-execution under the Build Spec section 7 gate. */
export const REVERSIBLE_ACTIONS: ReadonlySet<CanonicalAction> = new Set<CanonicalAction>([
  'post_message',
  'create_issue',
  'flag_account',
])

/** Actions that must always go through human approval regardless of policy rules. */
export const NEVER_AUTO_ACTIONS: ReadonlySet<CanonicalAction> = new Set<CanonicalAction>([
  'create_ui_patch',
  'create_pr',
])

/**
 * Composio tool slugs per (toolkit, action).
 * VERIFY these against the Composio dashboard for the `usersessions` project before
 * relying on them in production; a wrong slug fails the action (it never runs an
 * unrelated tool, see executor.resolveComposioTool).
 */
export const COMPOSIO_TOOL_SLUGS: Partial<Record<`${ComposioToolkit}:${CanonicalAction}`, string>> = {
  'SLACK:post_message':      'SLACK_SEND_MESSAGE',
  'JIRA:create_issue':       'JIRA_CREATE_ISSUE',
  'LINEAR:create_issue':     'LINEAR_CREATE_LINEAR_ISSUE',
  'GITHUB:create_issue':     'GITHUB_CREATE_AN_ISSUE',
  'GITHUB:create_pr':        'GITHUB_CREATE_A_PULL_REQUEST',
  'GITLAB:create_issue':     'GITLAB_CREATE_ISSUE',
  'GITLAB:create_pr':        'GITLAB_CREATE_MERGE_REQUEST',
  'HUBSPOT:flag_account':    'HUBSPOT_CREATE_TASK',
  'SALESFORCE:flag_account': 'SALESFORCE_CREATE_TASK',
}

// Legacy / free-form names the model or old DB rows may contain.
const ALIASES: Record<string, CanonicalAction> = {
  post_message: 'post_message',
  send_message: 'post_message',
  chat_post_message: 'post_message',
  slack_send_message: 'post_message',
  slack_chat_post_message: 'post_message',
  slack_alert: 'post_message',
  alert: 'post_message',
  notify: 'post_message',

  create_issue: 'create_issue',
  create_ticket: 'create_issue',
  create_bug: 'create_issue',
  file_bug: 'create_issue',
  open_issue: 'create_issue',
  jira_create_issue: 'create_issue',
  linear_create_linear_issue: 'create_issue',
  linear_create_issue: 'create_issue',
  github_create_an_issue: 'create_issue',
  github_create_issue: 'create_issue',
  gitlab_create_issue: 'create_issue',

  flag_account: 'flag_account',
  create_task: 'flag_account',
  crm_flag: 'flag_account',
  flag_churn_risk: 'flag_account',
  churn_flag: 'flag_account',
  hubspot_create_task: 'flag_account',
  salesforce_create_task: 'flag_account',

  create_ui_patch: 'create_ui_patch',
  ui_patch: 'create_ui_patch',
  uipatch: 'create_ui_patch',
  live_patch: 'create_ui_patch',
  patch: 'create_ui_patch',

  create_pr: 'create_pr',
  code_pr: 'create_pr',
  open_pr: 'create_pr',
  create_pull_request: 'create_pr',
  create_merge_request: 'create_pr',
  github_create_a_pull_request: 'create_pr',
}

/** Map any model/legacy action string onto the canonical vocabulary. Returns null if unknown. */
export function normalizeAction(raw: unknown): CanonicalAction | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return ALIASES[key] ?? null
}

export function isCanonicalAction(value: unknown): value is CanonicalAction {
  return typeof value === 'string' && (CANONICAL_ACTIONS as readonly string[]).includes(value)
}

export function isReversibleAction(action: unknown): boolean {
  const c = normalizeAction(action)
  return c !== null && REVERSIBLE_ACTIONS.has(c)
}

export function neverAuto(action: unknown): boolean {
  const c = normalizeAction(action)
  return c !== null && NEVER_AUTO_ACTIONS.has(c)
}

export function toolkitSupportsAction(toolkit: unknown, action: CanonicalAction): boolean {
  if (typeof toolkit !== 'string') return false
  return (ACTION_TOOLKITS[action] as readonly string[]).includes(toolkit.toUpperCase())
}

/** Composio slug for a (toolkit, action) pair, or null if not mapped. */
export function composioSlugFor(toolkit: unknown, action: unknown): string | null {
  const c = normalizeAction(action)
  if (!c || typeof toolkit !== 'string') return null
  const key = `${toolkit.toUpperCase()}:${c}` as `${ComposioToolkit}:${CanonicalAction}`
  return COMPOSIO_TOOL_SLUGS[key] ?? null
}

/** Toolkits connected by the client that can carry `action`, in preference order. */
export function toolkitsFor(action: CanonicalAction, availableToolkits: readonly string[]): ComposioToolkit[] {
  const available = new Set(availableToolkits.map((t) => t.toUpperCase()))
  return ACTION_TOOLKITS[action].filter((t) => available.has(t))
}
