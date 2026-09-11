-- ── Migration: Add website_url and audit_status to us_clients ────────────────
-- Adds:
--   website_url   - the URL of the customer's public site, used by the crawler
--   audit_status  - tracks the initial crawl state ('pending', 'running', 'done', 'error')
-- Both columns are nullable so existing rows are unaffected.

ALTER TABLE us_clients
  ADD COLUMN IF NOT EXISTS website_url    TEXT,
  ADD COLUMN IF NOT EXISTS audit_status  TEXT
    CHECK (audit_status IN ('pending', 'running', 'done', 'error'));

-- Index so the dashboard can quickly find clients awaiting or done with audit
CREATE INDEX IF NOT EXISTS us_clients_audit_status_idx
  ON us_clients(audit_status)
  WHERE audit_status IS NOT NULL;
