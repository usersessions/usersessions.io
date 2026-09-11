/**
 * Reasoning layer (Build Spec section 7)
 *
 * Input per session:
 *   - Normalized session summary (error counts, duration, rage clicks)
 *   - Event list excerpts (errors, network failures, rage clicks)
 *   - Enrichment context (account ARR/tier from CRM)
 *   - Client's active PolicyRules and connected toolkits
 *
 * Output: { category, severity, confidence, summary, recommended_actions[] }
 *
 * Model routing is decided by the pipeline (_pipeline.ts): Haiku first pass for
 * every session, Sonnet second pass for P0/P1 only. `MODEL` below is the fallback
 * when no override is passed.
 *
 * Autonomy gate is enforced in policy.ts, not here.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  USSession,
  USEvent,
  USPolicyRule,
  EnrichmentContext,
  ReasoningOutput,
  RecommendedAction,
  FindingCategory,
  FindingSeverity,
  FindingSignals,
  ComposioToolkit,
} from '@/types/usersessions'
import { CANONICAL_ACTIONS, normalizeAction, toolkitSupportsAction } from '@/services/action-catalog'

/** Fallback model when the pipeline passes no override. */
const MODEL = process.env.ANTHROPIC_MODEL || process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-4-5'

const CATEGORIES: readonly FindingCategory[] = ['bug', 'friction', 'billing', 'security']
const SEVERITIES: readonly FindingSeverity[] = ['P0', 'P1', 'P2', 'P3']
const TOOLKITS: readonly ComposioToolkit[] = ['SLACK', 'JIRA', 'LINEAR', 'SALESFORCE', 'HUBSPOT', 'GITHUB', 'GITLAB', 'UIPATCH']

// -- System prompt ------------------------------------------------------------

const SYSTEM_BLOCKS: Anthropic.TextBlockParam[] = [
  {
    type: 'text',
    text: `You are a revenue-impact classifier for UserSessions.io. Your sole job is to analyze a web session from a SaaS product and classify it into a structured Finding that will trigger a real action (Slack alert, issue, CRM flag, UI patch or code PR) on behalf of the product team.

HARD CONSTRAINTS:
1. Output ONLY via the classify_session tool. No prose responses.
2. The confidence score must reflect genuine uncertainty. If you cannot determine severity without guessing, score confidence below 0.70.
3. Never classify a session as P0 unless there is clear evidence of a functional break affecting multiple users or a high-ARR account.
4. recommended_actions MUST only reference toolkits listed under CLIENT'S CONNECTED TOOLKITS. Omit anything else.
5. If the session shows no meaningful friction, errors, or revenue risk, return category=friction, severity=P3, confidence=0.30, recommended_actions=[]. Do not fabricate a finding.
6. summary must be one sentence, human-readable, safe to paste into Slack or an issue title.
7. PRECISION GATING: a single rage click is not P2 and never triggers an action. A rage-click cluster must contain 5+ clicks on the same element, or be accompanied by an error.`,
    cache_control: { type: 'ephemeral' },
  },
  {
    type: 'text',
    text: `SEVERITY TAXONOMY:
- P0: Revenue-blocking, affecting multiple sessions or a high-ARR account (>= $50K ARR). Example: checkout broken site-wide.
- P1: Functional break on a single high-ARR account (>= $10K ARR), or repeated P2 pattern across 3+ sessions in the same hour.
- P2: Friction with no functional block: rage clicks, dead clicks, repeated failed form attempts, slow responses.
- P3: Minor or cosmetic; single error with no abandonment; low-ARR account; very low confidence.

CATEGORIES:
- bug: JavaScript errors, network failures (4xx/5xx), broken interactions where the user could not complete an intended action.
- friction: Rage clicks, dead clicks, retries, repeated views of the same error state.
- billing: Failed payments, billing form errors, checkout abandonment after the payment step.
- security: Authentication failures, suspicious request patterns, repeated 401/403 for a user who should be authenticated.

ACCOUNT VALUE WEIGHTING:
- ARR >= $100K: any P2 or above warrants a Slack alert minimum; P1 warrants a CRM flag.
- ARR $10K-$100K: P1 or above warrants action; P2 is log-only unless severity is clear.
- ARR < $10K or unknown: P0 only warrants proactive action.

ACTION VOCABULARY (use these exact action names):
- post_message     -> SLACK. params: { text?: string }
- create_issue     -> JIRA | LINEAR | GITHUB | GITLAB. params: { title?: string, description?: string }
- flag_account     -> SALESFORCE | HUBSPOT. params: { note?: string }
- create_ui_patch  -> UIPATCH (only when listed). Cosmetic/text/attribute fixes only. params: { target_selector: string, patch_type: 'css'|'text'|'attribute', patch_payload: object, url_pattern?: string, target_signals?: { text?: string, ariaLabel?: string, dataTestId?: string } }
- create_pr        -> GITHUB | GITLAB (only when listed). params: { description: string }

Do not invent toolkits or action names. Prefer the smallest action that resolves the finding.`,
    cache_control: { type: 'ephemeral' },
  },
]

// -- Tool definition -----------------------------------------------------------

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'classify_session',
  description: 'Classify a web session into a structured finding with recommended actions.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: { type: 'string', enum: [...CATEGORIES], description: 'The primary category of the issue detected.' },
      severity: { type: 'string', enum: [...SEVERITIES], description: 'Revenue impact severity.' },
      confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence in this classification, 0.0-1.0.' },
      summary: { type: 'string', description: 'One-sentence human-readable description, safe for Slack or an issue title.' },
      recommended_actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            toolkit: { type: 'string', enum: [...TOOLKITS] },
            action: { type: 'string', enum: [...CANONICAL_ACTIONS] },
            params: { type: 'object', additionalProperties: true },
          },
          required: ['toolkit', 'action', 'params'],
        },
        description: 'Actions to execute. Only include toolkits the client has connected.',
      },
    },
    required: ['category', 'severity', 'confidence', 'summary', 'recommended_actions'],
  },
}

// -- Fallback (used when Claude is unreachable) ----------------------------------

function fallbackOutput(session: USSession): ReasoningOutput {
  console.error(`[reasoning] FALLBACK for session ${session.id}: Claude API unreachable`)
  return {
    category: 'friction',
    severity: 'P3',
    confidence: 0.1,
    summary: 'Session could not be classified: AI reasoning temporarily unavailable.',
    recommended_actions: [],
  }
}

// -- Output sanitisation ----------------------------------------------------------

function clamp01(n: unknown): number {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

/**
 * The prompt asks the model to stay inside the connected toolkits and the action
 * vocabulary; this enforces it. Anything that does not fit is dropped, never guessed.
 */
export function sanitizeRecommendedActions(
  raw: unknown,
  availableToolkits: readonly string[],
): RecommendedAction[] {
  if (!Array.isArray(raw)) return []
  const available = new Set(availableToolkits.map((t) => String(t).toUpperCase()))
  const seen = new Set<string>()
  const out: RecommendedAction[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const toolkit = String((item as any).toolkit ?? '').toUpperCase() as ComposioToolkit
    const action = normalizeAction((item as any).action)
    if (!action) continue
    if (!(TOOLKITS as readonly string[]).includes(toolkit)) continue
    if (!available.has(toolkit)) continue
    if (!toolkitSupportsAction(toolkit, action)) continue
    const key = `${toolkit}:${action}`
    if (seen.has(key)) continue
    seen.add(key)
    const params = (item as any).params
    out.push({
      toolkit,
      action,
      params: params && typeof params === 'object' && !Array.isArray(params) ? params : {},
    })
  }
  return out
}

// -- User message builder ---------------------------------------------------------

function buildUserMessage(params: {
  session: USSession
  events: USEvent[]
  enrichment: EnrichmentContext
  policyRules: USPolicyRule[]
  availableToolkits: string[]
  signals?: FindingSignals
  priorClassification?: ReasoningOutput
}): string {
  const { session, events, enrichment, policyRules, availableToolkits, signals, priorClassification } = params

  const errorEvents = events.filter((e) => e.type === 'error' || e.type === 'network_fail')
  const frictionEvents = events.filter((e) => e.type === 'rage_click' || e.type === 'dead_click')

  const errorSummary = errorEvents
    .slice(0, 5)
    .map((e) => {
      const p = e.payload as any
      if (e.type === 'error') return `ERROR: ${p.error_message ?? 'unknown'} (type=${p.error_type ?? '?'}${p.source ? `, source=${p.source}` : ''})`
      return `NETWORK FAIL: ${p.http_method ?? 'GET'} ${p.http_url ?? '?'} -> ${p.http_status ?? '?'}`
    })
    .join('\n')

  const accountLine = enrichment.arr != null
    ? `Account ARR: $${enrichment.arr.toLocaleString()} | Health: ${enrichment.health_score ?? 'unknown'} | CSM: ${enrichment.csm_owner ?? 'unknown'}`
    : 'Account ARR: unknown (no CRM match found)'

  const policyLine = policyRules.length > 0
    ? policyRules.map((r) => `- "${r.name}": ${r.autonomy_level} -> ${r.action_template.toolkit}/${r.action_template.action}`).join('\n')
    : 'No custom policy rules configured; use default severity-based routing.'

  const rageCount = signals?.rage_click_count ?? session.rage_click_count
  const errorCount = signals?.error_count ?? session.error_count
  const elementLine = signals?.element_path ? `Most rage-clicked element: ${signals.element_path}` : ''
  const pageLine = signals?.page_url ?? session.page_url ? `Page: ${signals?.page_url ?? session.page_url}` : ''

  return `SESSION TO CLASSIFY:
Source: ${session.source} | Session ID: ${session.source_session_id}
Duration: ${session.duration_seconds ?? '?'}s | Errors: ${errorCount} | Rage clicks: ${rageCount}
${pageLine}
${elementLine}
Replay URL: ${session.replay_url ?? 'not available'}

${accountLine}

ERROR / NETWORK EVENT LOG (up to 5):
${errorSummary || '(none)'}

FRICTION EVENTS: ${frictionEvents.length} rage/dead click events recorded

CLIENT'S CONNECTED TOOLKITS: ${availableToolkits.join(', ') || 'none'}

CLIENT'S POLICY RULES:
${policyLine}

Classify this session. If it warrants an action, populate recommended_actions using only the connected toolkits listed above and the exact action names from the vocabulary.
${priorClassification ? `
NOTE: This is a SECOND-PASS verification. The session was initially classified as ${priorClassification.severity} (${priorClassification.category}).
Verify this classification with deep scrutiny. Does it truly meet the strict criteria for ${priorClassification.severity}? If not, downgrade it.
` : ''}`
}

// -- Main classification entry point --------------------------------------------

export async function classifySession(params: {
  session: USSession
  events: USEvent[]
  enrichment: EnrichmentContext
  policyRules: USPolicyRule[]
  /** Toolkit slugs the client may be routed to (upper-case, e.g. 'SLACK', 'UIPATCH'). */
  availableToolkits: string[]
  apiKey: string
  modelOverride?: string
  signals?: FindingSignals
  priorClassification?: ReasoningOutput
}): Promise<ReasoningOutput> {
  const { session, events, enrichment, policyRules, availableToolkits, apiKey, modelOverride, signals, priorClassification } = params
  const anthropic = new Anthropic({ apiKey })
  const maxRetries = 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: modelOverride ?? MODEL,
        max_tokens: 1024,
        system: SYSTEM_BLOCKS,
        tools: [CLASSIFY_TOOL],
        // Force the structured output; 'auto' let the model answer in prose and burned retries.
        tool_choice: { type: 'tool', name: 'classify_session' },
        messages: [
          {
            role: 'user',
            content: buildUserMessage({ session, events, enrichment, policyRules, availableToolkits, signals, priorClassification }),
          },
        ],
      })

      const toolCall = response.content.find(
        (c) => c.type === 'tool_use' && c.name === 'classify_session',
      ) as Anthropic.ToolUseBlock | undefined

      if (!toolCall?.input) {
        console.warn(`[reasoning] Attempt ${attempt + 1}: no tool_use block in response`)
        continue
      }

      const raw = toolCall.input as any

      if (!CATEGORIES.includes(raw.category) || !SEVERITIES.includes(raw.severity) || raw.confidence == null || typeof raw.summary !== 'string') {
        console.warn(`[reasoning] Attempt ${attempt + 1}: incomplete or invalid tool output`, raw)
        continue
      }

      return {
        category: raw.category as FindingCategory,
        severity: raw.severity as FindingSeverity,
        confidence: clamp01(raw.confidence),
        summary: String(raw.summary).slice(0, 500),
        recommended_actions: sanitizeRecommendedActions(raw.recommended_actions, availableToolkits),
        signals,
      }
    } catch (err: any) {
      console.error(`[reasoning] Attempt ${attempt + 1} failed: ${err.message}`)
      if (attempt === maxRetries - 1) return fallbackOutput(session)
    }
  }

  return fallbackOutput(session)
}
