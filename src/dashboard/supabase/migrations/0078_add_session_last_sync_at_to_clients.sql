-- Add last sync timestamp to clients for UI display
ALTER TABLE us_clients ADD COLUMN session_last_sync_at timestamptz;
