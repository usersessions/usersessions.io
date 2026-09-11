-- Heatmap Aggregates Table
CREATE TABLE us_heatmap_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  page_url_pattern text NOT NULL,
  viewport_bucket text NOT NULL CHECK (viewport_bucket IN ('desktop', 'tablet', 'mobile')),
  date_trunc_hour timestamptz NOT NULL,
  click_density_grid jsonb NOT NULL DEFAULT '{}'::jsonb,
  scroll_depth_histogram jsonb NOT NULL DEFAULT '{}'::jsonb,
  attention_density_grid jsonb NOT NULL DEFAULT '{}'::jsonb,
  rage_click_clusters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, page_url_pattern, viewport_bucket, date_trunc_hour)
);

-- Enable RLS on Heatmaps
ALTER TABLE us_heatmap_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read their own heatmap aggregates"
  ON us_heatmap_aggregates FOR SELECT
  USING (auth.uid() = (SELECT profile_id FROM us_clients WHERE id = client_id));

-- MCP Tokens Table
CREATE TABLE us_mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES us_clients(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  name text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Enable RLS on MCP Tokens
ALTER TABLE us_mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read their own MCP tokens"
  ON us_mcp_tokens FOR SELECT
  USING (auth.uid() = (SELECT profile_id FROM us_clients WHERE id = client_id));

CREATE POLICY "Clients can manage their own MCP tokens"
  ON us_mcp_tokens FOR ALL
  USING (auth.uid() = (SELECT profile_id FROM us_clients WHERE id = client_id));
