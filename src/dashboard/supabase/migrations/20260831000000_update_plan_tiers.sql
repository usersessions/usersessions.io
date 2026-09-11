-- Drop the old constraint
ALTER TABLE us_clients DROP CONSTRAINT IF EXISTS us_clients_plan_tier_check;

-- Map old tiers to new tiers
UPDATE us_clients SET plan_tier = 'free' WHERE plan_tier = 'design_partner';
UPDATE us_clients SET plan_tier = 'starter' WHERE plan_tier = 'paid_pilot';
UPDATE us_clients SET plan_tier = 'pro' WHERE plan_tier = 'growth';

-- Add the new constraint
ALTER TABLE us_clients ADD CONSTRAINT us_clients_plan_tier_check 
  CHECK (plan_tier IN ('free','starter','pro','business','enterprise'));
