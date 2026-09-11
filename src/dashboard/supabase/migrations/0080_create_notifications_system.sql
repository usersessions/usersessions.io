-- ============================================================
-- 0080_notification_events.sql
-- UserSessions.io — Notification System (Build Spec notification spec v1.0)
-- Three channels: Slack (primary) → Email (escalation) → In-app (system of record)
-- ============================================================

-- ── Notification event type enum ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'us_notif_event_type') THEN
    CREATE TYPE us_notif_event_type AS ENUM (
      -- Finding lifecycle
      'finding_pending_approval',
      'finding_escalation',          -- Slack unactioned past window → email escalation
      -- Action lifecycle
      'action_failed',
      'action_auto_executed',        -- in-app only, no interruption
      -- Integration
      'integration_disconnected',
      'integration_connected',
      -- Billing
      'payment_failed',
      'usage_threshold_80',
      'usage_threshold_100',
      'monthly_invoice',
      -- Security / account
      'policy_autonomy_increased',
      'team_member_added',
      'api_key_event',              -- stub: v2 pending api_keys table
      'new_login_unrecognized',     -- stub: v2 pending device fingerprint table
      -- Lifecycle / onboarding
      'onboarding_welcome',
      'first_finding_detected',
      'weekly_digest',
      'pilot_checkin'
    );
  END IF;
END $$;

-- ── NotificationEvent ─────────────────────────────────────────
-- System of record for every notification fired. The in-app bell reads from here.
-- One row per (event_type, source_id, recipient_email) — idempotency_key enforces uniqueness.
CREATE TABLE us_notification_events (
  id                    UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID                     REFERENCES us_clients(id) ON DELETE SET NULL,
  event_type            us_notif_event_type      NOT NULL,
  -- Source object reference (only one is set per row)
  source_type           TEXT                     CHECK (source_type IN ('finding','action','integration','billing','policy','team','auth','system')),
  source_id             UUID,                    -- finding_id / action_id / etc
  -- Recipient
  recipient_user_id     UUID                     REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email       TEXT                     NOT NULL,
  -- Delivery
  channels_attempted    TEXT[]                   NOT NULL DEFAULT '{}',
  delivery_status       JSONB                    NOT NULL DEFAULT '{}',
  -- e.g. {"slack": "sent", "email": "skipped", "inapp": "logged"}
  -- Actioning
  actioned_at           TIMESTAMPTZ,             -- set when the user acts (approve/dismiss) from any channel
  actioned_channel      TEXT,                    -- 'slack' | 'email' | 'inapp'
  -- Escalation
  escalation_due_at     TIMESTAMPTZ,             -- when to fire the email escalation if still unactioned
  escalation_sent_at    TIMESTAMPTZ,
  -- Idempotency: one event per (type, source, recipient)
  idempotency_key       TEXT                     NOT NULL,
  created_at            TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

CREATE INDEX us_notif_events_client_idx      ON us_notification_events(client_id, created_at DESC);
CREATE INDEX us_notif_events_recipient_idx   ON us_notification_events(recipient_email, created_at DESC);
CREATE INDEX us_notif_events_escalation_idx  ON us_notification_events(escalation_due_at)
  WHERE actioned_at IS NULL AND escalation_sent_at IS NULL AND escalation_due_at IS NOT NULL;

-- RLS: users see their own notifications
ALTER TABLE us_notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_notif_events_recipient" ON us_notification_events
  FOR SELECT USING (recipient_user_id = auth.uid());

-- ── Per-severity notification preferences ─────────────────────
-- Added to profiles. Controls whether a severity triggers Slack+email (interrupt),
-- email only, or just logs in-app.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_p0_channel  TEXT NOT NULL DEFAULT 'all'
    CHECK (notif_p0_channel  IN ('all','email_only','in_app_only')),
  ADD COLUMN IF NOT EXISTS notif_p1_channel  TEXT NOT NULL DEFAULT 'all'
    CHECK (notif_p1_channel  IN ('all','email_only','in_app_only')),
  ADD COLUMN IF NOT EXISTS notif_p2_channel  TEXT NOT NULL DEFAULT 'all'
    CHECK (notif_p2_channel  IN ('all','email_only','in_app_only')),
  ADD COLUMN IF NOT EXISTS notif_p3_channel  TEXT NOT NULL DEFAULT 'in_app_only'
    CHECK (notif_p3_channel  IN ('all','email_only','in_app_only'));

-- ── Policy rule audit columns ─────────────────────────────────
-- Required to fire the "autonomy increased" security notification.
ALTER TABLE us_policy_rules
  ADD COLUMN IF NOT EXISTS changed_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_autonomy_level TEXT
    CHECK (previous_autonomy_level IN ('auto','approve_required')),
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ DEFAULT NOW();

-- ── Slack bot token per client (optional, falls back to env var) ─
ALTER TABLE us_clients
  ADD COLUMN IF NOT EXISTS slack_bot_token TEXT;  -- encrypted at rest by Supabase Vault
