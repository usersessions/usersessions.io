-- Add pii_masked flag to us_sessions
ALTER TABLE us_sessions ADD COLUMN IF NOT EXISTS pii_masked boolean DEFAULT false;
