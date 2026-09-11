-- Fix profiles_plan_check to include all valid plan IDs
-- The old constraint was missing 'enterprise', 'agency', and legacy IDs, causing
-- admin plan updates to silently fail with a constraint violation.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN (
    'free',
    'starter',
    'pro',
    'business',
    'enterprise',
    'agency',    -- legacy internal plan
    'audit',     -- legacy alias → starter
    'standard'   -- legacy alias → pro
  ));
