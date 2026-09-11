-- ── Onboarding & Activation columns on us_clients ─────────────────────────
ALTER TABLE us_clients
  ADD COLUMN IF NOT EXISTS client_domain           text,
  ADD COLUMN IF NOT EXISTS capture_public_key      text UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS script_installed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS first_heatmap_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_action_seen_at    timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_step         text NOT NULL DEFAULT 'signed_up'
    CHECK (activation_step IN (
      'signed_up',
      'domain_added',
      'script_verified',
      'heatmap_viewed',
      'destination_connected',
      'first_action_seen'
    ));

-- ── Activation funnel events — one row per step per client ─────────────────
-- Drop-off is visible by querying which steps exist vs which are missing.
CREATE TABLE IF NOT EXISTS us_activation_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  step        text        NOT NULL CHECK (step IN (
                'signed_up',
                'domain_added',
                'script_verified',
                'heatmap_viewed',
                'destination_connected',
                'first_action_seen'
              )),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb       NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS us_activation_events_client_step_idx
  ON us_activation_events (client_id, step);

CREATE INDEX IF NOT EXISTS us_activation_events_step_idx
  ON us_activation_events (step, occurred_at DESC);

-- RLS: clients can only see their own activation events
ALTER TABLE us_activation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "us_activation_events_owner" ON us_activation_events
  FOR ALL USING (
    client_id IN (SELECT id FROM us_clients WHERE profile_id = auth.uid())
  );

COMMENT ON TABLE us_activation_events IS 'One row per activation funnel step per client. Used to measure drop-off at each stage.';
COMMENT ON COLUMN us_clients.capture_public_key IS 'Stable public key embedded in the capture snippet. Not a secret — safe to expose in client JS.';
COMMENT ON COLUMN us_clients.activation_step IS 'Current highest funnel step reached. Updated on each milestone.';
