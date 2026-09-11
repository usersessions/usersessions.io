/**
 * Agent (Computer Use) contracts shared by the extension and the dashboard planner.
 * The extension PERCEIVES the page, the dashboard PLANS via AI, the extension ACTS.
 */

export type AgentAction =
  | { type: 'click'; selector: string; description?: string }
  | { type: 'type'; selector: string; value: string; clearFirst?: boolean }
  | { type: 'select'; selector: string; value: string }
  | { type: 'upload'; selector: string; fileUrl: string }
  | { type: 'scroll'; direction: 'up' | 'down' | 'toElement'; selector?: string }
  | { type: 'wait'; durationMs: number }
  | { type: 'navigate'; url: string }
  | { type: 'submit'; selector: string }
  | { type: 'pause'; reason: 'auth_required' | 'captcha' | 'human_verification'; message: string }
  | { type: 'complete'; result: 'success' | 'already_exists' | 'error' }

export type AgentPageType = 'login_gate' | 'form_page' | 'captcha' | 'success' | 'error' | 'unknown'

export interface InteractiveElement {
  id: string
  tag: string
  type?: string
  name?: string
  placeholder?: string
  label?: string
  text?: string
  selector: string
  boundingBox: { x: number; y: number; width: number; height: number }
  isVisible: boolean
  ariaLabel?: string
}

export interface InputSnapshot {
  selector: string
  type: string
  name?: string
  id?: string
  placeholder?: string
  label?: string
  required?: boolean
  options?: string[]
  value?: string
}

export interface ButtonSnapshot {
  selector: string
  text: string
  type?: 'submit' | 'button'
  isPrimary?: boolean
}

export interface FormSnapshot {
  id: string
  action?: string
  method?: string
  fields: InputSnapshot[]
  submitButton?: string
}

export interface DOMSnapshot {
  textContent: string
  forms: FormSnapshot[]
  buttons: ButtonSnapshot[]
  inputs: InputSnapshot[]
  headings: string[]
  links: { text: string; href: string }[]
}

export interface PerceptionPayload {
  url: string
  title: string
  pageType: AgentPageType
  screenshotBase64?: string
  domSnapshot: DOMSnapshot
  interactiveElements: InteractiveElement[]
  timestamp: number
  sessionId: string
  stepIndex: number
  platformId: string
}

/** Values the agent may fill into forms — founder-approved data only, never invented. */
export interface AgentRunContext {
  title: string
  url: string
  tagline: string
  hook: string
  body: string
  founderName: string
  contactEmail: string
  category: string
  tags: string[]
  pricingModel: string
  socialLinks?: Record<string, string>
  userInput: string
}

export interface ActionPlan {
  sessionId: string
  stepIndex: number
  actions: AgentAction[]
  reasoning: string
  expectedOutcome: string
  fallbackActions?: AgentAction[]
}

export type AgentSessionStatus = 'running' | 'paused' | 'completed' | 'failed'
export type AgentSessionResult = 'success' | 'already_exists' | 'error' | 'cancelled'

export interface AgentSession {
  id: string
  platformId: string
  campaignId: string
  productId: string
  status: AgentSessionStatus
  currentStep: number
  totalSteps: number
  /** Fail-closed M6 gate: true unless the platform was verified live. Simulation never submits. */
  simulated: boolean
  runContext: AgentRunContext
  history: AgentAction[]
  pausedReason?: string
  result?: AgentSessionResult
  tabId?: number
  createdAt: string
  updatedAt: string
}

// ---------- Platform navigation scripts (rule-based flow per directory) ----------

export interface PlatformScriptStep {
  step: number
  description: string
  url?: string
  /** AgentRunContext key (or 'productHero' asset) -> CSS selector. */
  fieldMapping?: Record<string, string>
  expectedPageType?: AgentPageType
  actions: string[]
  successIndicators?: string[]
}

export interface PlatformScript {
  id: string
  name: string
  domain: string
  submitUrl: string
  authGate?: string
  difficulty: 'low' | 'medium' | 'high'
  authType: 'none' | 'email' | 'oauth' | 'magic_link'
  authProviders?: string[]
  steps: PlatformScriptStep[]
  mediaRequirements?: Record<
    string,
    { minWidth?: number; minHeight?: number; formats?: string[]; maxCount?: number; maxSizeMB?: number }
  >
  fieldRules?: Record<string, { maxLength?: number; required?: boolean }>
  successIndicators: string[]
  errorIndicators: string[]
}
