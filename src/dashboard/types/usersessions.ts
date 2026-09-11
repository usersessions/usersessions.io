/**
 * UserSessions.io — TypeScript domain types
 * Mirrors Build Spec v1.0 §4 data model.
 */

import { FindingStatus as FS, ActionStatus as AS, AutonomyLevel as AL } from './constants';

/** 'first_party' = sessions captured by our own capture.js (public/capture.js). */
export type SessionSource = 'datadog_rum' | 'posthog' | 'fullstory' | 'logrocket' | 'hotjar' | 'first_party';
export type PlanTier = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type FindingCategory = 'bug' | 'friction' | 'billing' | 'security';
export type FindingSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type FindingStatus = FS;
export type ActionStatus = AS;
export type ActionResult = 'success' | 'failed';
export type AutonomyLevel = AL;
export type ComposioToolkit = 'SLACK' | 'JIRA' | 'LINEAR' | 'SALESFORCE' | 'HUBSPOT' | 'UIPATCH' | 'GITHUB' | 'GITLAB';
export type EventType = 'click' | 'error' | 'network_fail' | 'rage_click' | 'dead_click' | 'page_view';

// ── Client (workspace) ─────────────────────────────────────────
export interface USClient {
  id: string;
  profile_id: string;
  name: string;
  connected_session_source: SessionSource | null;
  session_source_api_key: string | null;
  session_source_app_key: string | null;       // Datadog DD-APPLICATION-KEY
  composio_entity_id: string | null;
  connected_composio_apps: string[];
  slack_alert_channel: string | null;
  /**
   * Free-form per-client config. Known keys read by the executor:
   *   jira_project_key, linear_team_id, github_repo ('owner/repo'), gitlab_project
   */
  policy_config: Record<string, unknown>;
  plan_tier: PlanTier;
  ui_patching_terms_accepted: boolean;
  ui_patching_terms_accepted_at: string | null;
  source_code_read_granted: boolean;
  created_at: string;
}

// ── Session (normalized) ──────────────────────────────────────
export interface USSession {
  id: string;
  client_id: string;
  source: SessionSource;
  source_session_id: string;
  replay_url: string | null;
  end_user_id: string | null;
  mapped_account_id: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  error_count: number;
  rage_click_count: number;
  scroll_depth_pct?: number | null;   // first_party only
  page_url?: string | null;           // first_party only
  pii_masked: boolean;
  raw_metadata: Record<string, unknown>;
  ingested_at: string;
}

// ── Event ─────────────────────────────────────────────────────
export interface USEvent {
  id: string;
  session_id: string;
  type: EventType;
  payload: Record<string, unknown>;
  occurred_at: string | null;
}

// ── Recommended Action (within a Finding) ─────────────────────────
export interface RecommendedAction {
  toolkit: ComposioToolkit;
  /** Canonical action name, see services/action-catalog.ts */
  action: string;
  params: Record<string, unknown>;
}

// ── Raw signals that drove a finding (populated by the pipeline, not the model) ──
export interface FindingSignals {
  rage_click_count: number;
  error_count: number;
  network_fail_count: number;
  /** DOM path of the most rage-clicked element, if known */
  element_path: string | null;
  /** Funnel drop percentage, when the finding came from funnel analysis */
  funnel_drop_pct?: number | null;
  page_url?: string | null;
}

// ── Finding ───────────────────────────────────────────────────
export interface USFinding {
  id: string;
  client_id: string;
  session_id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: number;  // 0.000 – 1.000
  summary: string;
  account_value: number | null;   // ARR from enrichment
  recommended_actions: RecommendedAction[];
  status: FindingStatus;
  dismissed_reason: string | null;
  created_at: string;
}

// ── Action ────────────────────────────────────────────────────
export interface USAction {
  id: string;
  finding_id: string;
  client_id: string;
  composio_toolkit: ComposioToolkit;
  composio_action: string;
  params: Record<string, unknown>;
  autonomy_level: AutonomyLevel;
  status: ActionStatus;
  result: ActionResult | null;
  result_detail: Record<string, unknown> | null;
  approved_by: string | null;    // user email or 'auto'
  reversible: boolean;
  executed_at: string | null;
  created_at: string;
}

// ── PolicyRule ────────────────────────────────────────────────
export interface PolicyCondition {
  category?: FindingCategory;
  severity?: FindingSeverity;
  arr_gte?: number;       // minimum ARR to trigger
  arr_lt?: number;        // maximum ARR to trigger (exclusive)
}

export interface ActionTemplate {
  toolkit: ComposioToolkit;
  action: string;
  params_template: Record<string, unknown>;
}

export interface USPolicyRule {
  id: string;
  client_id: string;
  name: string;
  condition: PolicyCondition;
  action_template: ActionTemplate;
  autonomy_level: AutonomyLevel;
  active: boolean;
  precision_thresholds?: Record<string, unknown> | null;
  created_at: string;
}

// ── Account (CRM-enriched) ────────────────────────────────────
export interface USAccount {
  id: string;
  client_id: string;
  external_account_id: string;
  domain: string | null;
  arr: number | null;
  health_score: number | null;
  csm_owner: string | null;
  plan_tier_at_source: string | null;
  renewal_date: string | null;
  enriched_at: string | null;
  created_at: string;
}

// ── BillingEvent ──────────────────────────────────────────────
export interface USBillingEvent {
  id: string;
  client_id: string;
  action_id: string;
  payment_record_id: string | null;   // Paystack payment reference
  billing_period_start: string;
  billing_period_end: string;
  recorded_at: string | null;
  created_at: string;
}

// ── Reasoning output schema (Build Spec §7) ───────────────────────
export interface ReasoningOutput {
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: number;
  summary: string;
  recommended_actions: RecommendedAction[];
  /** Attached by the pipeline from session/event data. Never produced by the model. */
  signals?: FindingSignals;
}

// ── Normalizer output shape ─────────────────────────────────────
export interface NormalizedSession {
  source: SessionSource;
  source_session_id: string;
  replay_url: string | null;
  end_user_id: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  error_count: number;
  rage_click_count: number;
  events: Array<{
    type: EventType;
    payload: Record<string, unknown>;
    occurred_at: string | null;
  }>;
  raw_metadata: Record<string, unknown>;
}

// ── Enrichment context passed to reasoning ────────────────────────
export interface EnrichmentContext {
  account_id: string | null;
  arr: number | null;
  health_score: number | null;
  csm_owner: string | null;
  plan_tier: string | null;
  open_tickets: number;    // existing open Jira/Linear tickets for this account
}
