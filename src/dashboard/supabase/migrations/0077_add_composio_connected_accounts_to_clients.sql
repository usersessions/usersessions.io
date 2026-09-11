-- Add composio_connected_accounts JSONB to us_clients to store per-app connection IDs
ALTER TABLE us_clients ADD COLUMN IF NOT EXISTS composio_connected_accounts jsonb DEFAULT '{}'::jsonb;
