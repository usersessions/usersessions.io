-- ============================================================
-- 20260827000005_paystack_billing.sql
-- Implements Paystack-specific billing tables and license keys
-- for the UserSessions.io open-core/action-layer model.
-- ============================================================

-- ── Subscriptions (Managed Cloud) ────────────────────────────
-- Maps a client to their active Paystack subscription for
-- the Starter or Growth tiers.
CREATE TABLE us_subscriptions (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  UUID        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  paystack_customer_code     TEXT        NOT NULL,
  paystack_subscription_code TEXT        NOT NULL,
  plan_code                  TEXT        NOT NULL, -- Maps to Starter ($49) or Growth ($299)
  status                     TEXT        NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'non-renewing')),
  current_period_start       TIMESTAMPTZ NOT NULL,
  current_period_end         TIMESTAMPTZ NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id)
);
CREATE INDEX us_subscriptions_client_idx ON us_subscriptions(client_id);
ALTER TABLE us_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_subscriptions_owner" ON us_subscriptions
  FOR ALL USING (client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid()));

-- ── Enterprise Licenses (Self-Hosted) ────────────────────────
-- Self-hosted license keys unlocking the precision-gating
-- and live UI-patching safety architecture modules.
CREATE TABLE us_enterprise_licenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID        REFERENCES us_clients(id) ON DELETE CASCADE, -- Optional if distributed externally
  license_key     TEXT        NOT NULL UNIQUE,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX us_enterprise_licenses_key_idx ON us_enterprise_licenses(license_key);
ALTER TABLE us_enterprise_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_enterprise_licenses_owner" ON us_enterprise_licenses
  FOR ALL USING (client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid()));

-- ── Update Billing Events for Paystack ───────────────────────
-- The previous data model speculated Stripe. The final decision
-- is Paystack charging in USD. We rename the reference column.
ALTER TABLE us_billing_events
  RENAME COLUMN stripe_usage_record_id TO paystack_transaction_reference;
