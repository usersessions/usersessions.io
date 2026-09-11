-- ============================================================
-- 0082_create_profiles_trigger.sql
-- Creates the on_auth_user_created trigger so that every new
-- Supabase Auth signup automatically gets a corresponding row
-- in the public.profiles table.
-- ============================================================

-- ── Function: auto-create profile on auth.users INSERT ───────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    plan,
    subscription_status,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'user',
    'free',
    'none',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;   -- idempotent: ignore if row already exists
  RETURN NEW;
END;
$$;

-- ── Trigger: fire after every INSERT into auth.users ─────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
