-- Fix: The DEFAULT value for us_clients.plan_tier was never updated when
-- the check constraint was changed in 20260831000000_update_plan_tiers.sql.
-- This caused every new user signup to fail with a check constraint violation
-- because the DB trigger inserts with no explicit plan_tier (using the DEFAULT).
ALTER TABLE us_clients ALTER COLUMN plan_tier SET DEFAULT 'free';
