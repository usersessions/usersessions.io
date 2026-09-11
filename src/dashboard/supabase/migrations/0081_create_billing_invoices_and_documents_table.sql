-- ============================================================
-- 0081_billing_documents.sql
-- UserSessions.io — Client Document System
-- Billing Calculator & Client Document System spec (Part B)
-- ============================================================

-- ── Document type enum ────────────────────────────────────────
CREATE TYPE us_doc_type AS ENUM (
  'invoice',
  'receipt',
  'mbr',                  -- Monthly Business Review
  'security_soc2',
  'security_dpa',
  'security_faq',
  'audit_log_export',
  'failed_payment_notice',
  'renewal_reminder'
);

-- ── us_documents — versioned document registry ────────────────
-- Every document the product generates is registered here.
-- "Resend last month's invoice" = lookup, not regeneration.
CREATE TABLE us_documents (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID         REFERENCES us_clients(id) ON DELETE SET NULL,
  doc_type        us_doc_type  NOT NULL,
  -- For period-bound docs (invoices, MBRs): the billing/reporting period
  period_start    DATE,
  period_end      DATE,
  -- Storage: either a Supabase Storage path or an external URL (Paystack PDF link)
  storage_path    TEXT,
  external_url    TEXT,
  -- Version for static docs (security bundle); null for generated docs
  doc_version     TEXT,
  -- Delivery tracking
  sent_at         TIMESTAMPTZ,
  sent_to         TEXT[],      -- email addresses it was sent to
  -- Arbitrary doc-specific metadata (Paystack invoice ID, MBR metrics snapshot, etc.)
  metadata        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Idempotency: one doc per client+type+period (for period-bound docs)
  -- For non-period docs (security bundle), period columns are NULL and no unique constraint
  CONSTRAINT us_documents_period_unique
    UNIQUE NULLS NOT DISTINCT (client_id, doc_type, period_start, period_end)
);

CREATE INDEX us_documents_client_idx  ON us_documents(client_id, doc_type, created_at DESC);
CREATE INDEX us_documents_type_idx    ON us_documents(doc_type, created_at DESC);

-- RLS: clients see their own documents only
ALTER TABLE us_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "us_documents_client_select" ON us_documents
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM us_clients WHERE profile_id = auth.uid()
    )
  );

-- ── us_clients additions ──────────────────────────────────────

-- Pilot and contract renewal dates (triggers renewal_reminder cron)
ALTER TABLE us_clients
  ADD COLUMN IF NOT EXISTS pilot_end_date          DATE,
  ADD COLUMN IF NOT EXISTS contract_renewal_date   DATE;

-- Monthly Business Review delivery settings
ALTER TABLE us_clients
  ADD COLUMN IF NOT EXISTS mbr_enabled             BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mbr_recipient_email     TEXT;       -- defaults to account owner email if null

-- Deal stage (v1: column added now, auto-send-on-deal-stage logic deferred Phase 4)
ALTER TABLE us_clients
  ADD COLUMN IF NOT EXISTS deal_stage              TEXT
    CHECK (deal_stage IN ('pilot', 'negotiation', 'security_review', 'closed_won', 'churned'));

-- ── Notification type additions ───────────────────────────────
-- Add mbr_generated and renewal_reminder to the existing enum.
-- ALTER TYPE ... ADD VALUE is non-transactional in Postgres — safe to run here.
ALTER TYPE us_notif_event_type ADD VALUE IF NOT EXISTS 'mbr_generated';
ALTER TYPE us_notif_event_type ADD VALUE IF NOT EXISTS 'renewal_reminder';
