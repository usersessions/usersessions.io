-- Add idempotency key to us_actions
-- Keyed on finding_id + composio_action to prevent duplicate Slack messages / duplicate tickets
ALTER TABLE us_actions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Partial unique index: only enforce uniqueness for non-failed actions
-- (allows a re-attempt after a failed action with the same key)
CREATE UNIQUE INDEX IF NOT EXISTS us_actions_idempotency_key_idx
  ON us_actions (idempotency_key)
  WHERE status NOT IN ('failed', 'dismissed');

-- Add precision threshold overrides to policy rules
-- Stores per-category thresholds like min_rage_clicks, min_confidence, min_drop_pct
ALTER TABLE us_policy_rules
  ADD COLUMN IF NOT EXISTS precision_thresholds jsonb;

-- Update comment
COMMENT ON COLUMN us_actions.idempotency_key IS 'sha256 of (finding_id || composio_action) — prevents duplicate executions on retry';
COMMENT ON COLUMN us_actions.attempt_count IS 'Number of execution attempts made (0 = never attempted)';
COMMENT ON COLUMN us_actions.last_error IS 'Last Composio error message for failed/retrying actions';
COMMENT ON COLUMN us_policy_rules.precision_thresholds IS 'Per-category numeric thresholds that must be met before auto-execute fires';
