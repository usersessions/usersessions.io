-- Add onboarding state to us_clients
ALTER TABLE us_clients ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone;
