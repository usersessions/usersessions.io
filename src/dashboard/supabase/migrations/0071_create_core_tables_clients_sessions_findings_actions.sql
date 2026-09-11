-- ============================================================
-- 0071_usersessions_data_model.sql
-- UserSessions.io core schema (Build Spec v1.0 §4 + Pricing doc §5)
-- All tables prefixed us_ to coexist with the existing schema
-- during the migration period.
-- ============================================================

-- ── Client (workspace) ───────────────────────────────────────
-- One row per paying customer. Holds their session source
-- credentials and which Composio apps they have connected.
CREATE TABLE us_clients (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id               UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  -- Session source
  connected_session_source TEXT        CHECK (connected_session_source IN
                             ('datadog_rum','posthog','fullstory','logrocket','hotjar')),
  session_source_api_key   TEXT,        -- encrypted at rest by Supabase Vault in Phase 3
  session_source_app_key   TEXT,        -- Datadog DD-APPLICATION-KEY (second credential)
  -- Composio
  composio_entity_id       TEXT,        -- the Composio entity ID for this client's connections
  connected_composio_apps  TEXT[]      NOT NULL DEFAULT '{}',  -- e.g. ['slack','jira']
  slack_alert_channel      TEXT,        -- #channel name for Slack alerts
  -- Policy and billing
  policy_config            JSONB       NOT NULL DEFAULT '{}',
  plan_tier                TEXT        NOT NULL DEFAULT 'design_partner'
                             CHECK (plan_tier IN ('design_partner','paid_pilot','growth','enterprise')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX us_clients_profile_idx ON us_clients(profile_id);

-- ── Session (normalized) ─────────────────────────────────────
-- Vendor-specific fields mapped to a common shape by the normalizer.
-- Only stores what is needed for classification — not a full raw replay copy.
CREATE TABLE us_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  source            TEXT        NOT NULL CHECK (source IN
                      ('datadog_rum','posthog','fullstory','logrocket','hotjar')),
  source_session_id TEXT        NOT NULL,
  replay_url        TEXT,
  end_user_id       TEXT,       -- vendor's identifier for the end-user; may be hashed/masked
  mapped_account_id TEXT,       -- links to us_accounts.external_account_id after enrichment
  started_at        TIMESTAMPTZ,
  duration_seconds  INTEGER,
  error_count       INTEGER     NOT NULL DEFAULT 0,
  rage_click_count  INTEGER     NOT NULL DEFAULT 0,
  pii_masked        BOOLEAN     NOT NULL DEFAULT FALSE,  -- Build Spec §15: PII flag
  raw_metadata      JSONB       NOT NULL DEFAULT '{}',   -- kept for debugging only
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, source, source_session_id)
);
CREATE INDEX us_sessions_client_idx ON us_sessions(client_id, ingested_at DESC);
CREATE INDEX us_sessions_account_idx ON us_sessions(mapped_account_id) WHERE mapped_account_id IS NOT NULL;

-- ── Event ────────────────────────────────────────────────────
-- Only what's needed for classification, not a full raw replay.
CREATE TABLE us_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES us_sessions(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN
                ('click','error','network_fail','rage_click','dead_click','page_view')),
  payload     JSONB       NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ
);
CREATE INDEX us_events_session_idx ON us_events(session_id);
CREATE INDEX us_events_type_idx    ON us_events(session_id, type);

-- ── Finding ──────────────────────────────────────────────────
-- The AI's output. This is the atomic unit of value in the product.
-- status transitions: pending → approved | dismissed → executed | partially_executed
CREATE TABLE us_findings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  session_id          UUID        NOT NULL REFERENCES us_sessions(id) ON DELETE CASCADE,
  category            TEXT        NOT NULL CHECK (category IN ('bug','friction','billing','security')),
  severity            TEXT        NOT NULL CHECK (severity IN ('P0','P1','P2','P3')),
  confidence          NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  summary             TEXT        NOT NULL,
  account_value       NUMERIC,    -- ARR pulled from enrichment; drives priority
  recommended_actions JSONB       NOT NULL DEFAULT '[]',  -- array of {toolkit,action,params}
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','dismissed','executed','partially_executed')),
  dismissed_reason    TEXT,       -- populated when status = dismissed
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX us_findings_client_status_idx ON us_findings(client_id, status, created_at DESC);
CREATE INDEX us_findings_severity_idx      ON us_findings(client_id, severity) WHERE status = 'pending';

-- ── Action ───────────────────────────────────────────────────
-- One row per Composio call — whether auto-executed or human-approved.
-- This IS the audit trail and the usage-based billing meter.
-- (Pricing doc §3: every row where status=executed AND result=success is one billable unit.)
CREATE TABLE us_actions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id       UUID        NOT NULL REFERENCES us_findings(id) ON DELETE CASCADE,
  client_id        UUID        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  composio_toolkit TEXT        NOT NULL,  -- 'SLACK', 'JIRA', 'LINEAR', 'SALESFORCE', 'HUBSPOT'
  composio_action  TEXT        NOT NULL,  -- 'post_message', 'create_issue', 'flag_account'
  params           JSONB       NOT NULL DEFAULT '{}',
  autonomy_level   TEXT        NOT NULL CHECK (autonomy_level IN ('auto','approve_required')),
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approve_required','approved','dismissed','executing','executed','failed')),
  result           TEXT        CHECK (result IN ('success','failed')),
  result_detail    JSONB,      -- Composio response payload or error details
  approved_by      TEXT,       -- user email for human approvals, 'auto' for autonomous execution
  reversible       BOOLEAN     NOT NULL DEFAULT TRUE,
  executed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX us_actions_finding_idx  ON us_actions(finding_id);
CREATE INDEX us_actions_client_idx   ON us_actions(client_id, created_at DESC);
-- Billing meter: fast scan for billable actions
CREATE INDEX us_actions_billing_idx  ON us_actions(client_id, executed_at)
  WHERE status = 'executed' AND result = 'success';

-- ── PolicyRule ───────────────────────────────────────────────
-- Client-configurable rules. v1 UI: dropdowns, not a full DSL editor.
-- condition: {category?, severity?, arr_gte?, arr_lt?}
-- action_template: {toolkit, action, params_template}
CREATE TABLE us_policy_rules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  condition       JSONB       NOT NULL DEFAULT '{}',
  action_template JSONB       NOT NULL DEFAULT '{}',
  autonomy_level  TEXT        NOT NULL DEFAULT 'approve_required'
                    CHECK (autonomy_level IN ('auto','approve_required')),
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX us_policy_rules_client_idx ON us_policy_rules(client_id) WHERE active = TRUE;

-- ── Account (CRM-enriched) ───────────────────────────────────
-- Populated via Composio read calls to Salesforce/HubSpot between
-- ingestion and reasoning. ARR/health here is what the reasoning
-- layer uses to set severity for enterprise accounts.
CREATE TABLE us_accounts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  external_account_id   TEXT        NOT NULL,  -- Salesforce/HubSpot account ID
  domain                TEXT,                  -- used to match sessions by end-user domain
  arr                   NUMERIC,
  health_score          NUMERIC,
  csm_owner             TEXT,
  plan_tier_at_source   TEXT,
  renewal_date          DATE,
  enriched_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, external_account_id)
);
CREATE INDEX us_accounts_client_idx  ON us_accounts(client_id);
CREATE INDEX us_accounts_domain_idx  ON us_accounts(domain) WHERE domain IS NOT NULL;

-- ── BillingEvent ─────────────────────────────────────────────
-- Pricing doc §5: one row per Action sent to Stripe.
-- Keyed on action_id for idempotency — a retried job never double-bills.
CREATE TABLE us_billing_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  action_id             UUID        NOT NULL REFERENCES us_actions(id) ON DELETE CASCADE,
  stripe_usage_record_id TEXT,       -- set once successfully sent to Stripe
  billing_period_start  DATE        NOT NULL,
  billing_period_end    DATE        NOT NULL,
  sent_to_stripe_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (action_id)                -- idempotency constraint
);
CREATE INDEX us_billing_events_client_period_idx
  ON us_billing_events(client_id, billing_period_start);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE us_clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_findings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_actions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_policy_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_billing_events ENABLE ROW LEVEL SECURITY;

-- Owners can read/write their own client's data.
-- Service role bypasses RLS for server-side jobs (ingestion, cron).
CREATE POLICY "us_clients_owner" ON us_clients
  FOR ALL USING (profile_id = auth.uid());

CREATE POLICY "us_sessions_owner" ON us_sessions
  FOR ALL USING (
    client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "us_events_owner" ON us_events
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM us_sessions s
      JOIN us_clients c ON c.id = s.client_id
      WHERE c.profile_id = auth.uid()
    )
  );

CREATE POLICY "us_findings_owner" ON us_findings
  FOR ALL USING (
    client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "us_actions_owner" ON us_actions
  FOR ALL USING (
    client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "us_policy_rules_owner" ON us_policy_rules
  FOR ALL USING (
    client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "us_accounts_owner" ON us_accounts
  FOR ALL USING (
    client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid())
  );

CREATE POLICY "us_billing_events_owner" ON us_billing_events
  FOR ALL USING (
    client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid())
  );
