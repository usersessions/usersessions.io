-- Add source_code_read_granted to clients
ALTER TABLE us_clients ADD COLUMN source_code_read_granted boolean NOT NULL DEFAULT false;

-- Add stale status to patches enum
ALTER TYPE ui_patch_status ADD VALUE 'stale';

-- Add target_signals JSONB to patches for multi-signal matching
ALTER TABLE us_ui_patches ADD COLUMN target_signals jsonb;
