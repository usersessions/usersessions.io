-- The application assumes exactly one us_clients row per profile
-- (`.eq('profile_id', user.id).maybeSingle()` everywhere) and /api/sources/connect
-- upserts with ON CONFLICT (profile_id), which errors without a unique constraint.
--
-- Guarded: if duplicates already exist the index is skipped with a WARNING so the
-- migration does not halt deploys. Deduplicate manually and re-run in that case.
DO $$
BEGIN
  IF EXISTS (SELECT profile_id FROM us_clients GROUP BY profile_id HAVING count(*) > 1) THEN
    RAISE WARNING 'us_clients has duplicate profile_id rows; unique index NOT created. Deduplicate and re-run.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS us_clients_profile_id_unique ON us_clients(profile_id);
  END IF;
END $$;
