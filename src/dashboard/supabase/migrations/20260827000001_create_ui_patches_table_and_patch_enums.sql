-- Create ENUM types for UIPatch
CREATE TYPE ui_patch_type AS ENUM ('css', 'attribute', 'text', 'redirect');
CREATE TYPE ui_patch_status AS ENUM ('shadow', 'canary', 'live', 'rolled_back', 'disabled');

CREATE TABLE us_ui_patches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES us_findings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  target_selector text NOT NULL,
  patch_type ui_patch_type NOT NULL,
  patch_payload jsonb NOT NULL,
  status ui_patch_status NOT NULL DEFAULT 'shadow',
  canary_percentage integer NOT NULL DEFAULT 5,
  baseline_metrics jsonb,
  live_metrics jsonb,
  rollback_trigger jsonb,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  canary_started_at timestamptz,
  promoted_to_live_at timestamptz,
  rolled_back_at timestamptz
);

-- Enable RLS
ALTER TABLE us_ui_patches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read their own patches"
  ON us_ui_patches FOR SELECT
  USING (auth.uid() = (SELECT profile_id FROM us_clients WHERE id = client_id));

CREATE POLICY "Clients can update their own patches"
  ON us_ui_patches FOR UPDATE
  USING (auth.uid() = (SELECT profile_id FROM us_clients WHERE id = client_id));

CREATE POLICY "Clients can insert their own patches"
  ON us_ui_patches FOR INSERT
  WITH CHECK (auth.uid() = (SELECT profile_id FROM us_clients WHERE id = client_id));
