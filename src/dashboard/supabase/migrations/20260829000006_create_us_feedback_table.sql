-- ─── us_feedback ─────────────────────────────────────────────────────────────
-- Stores all feedback submitted via the Feedback button on the homepage and
-- the in-app sidebar. Not tied to any specific client org — intentionally
-- anonymous-friendly (name and email are optional).

create table if not exists public.us_feedback (
  id           uuid        primary key default gen_random_uuid(),
  name         text,
  email        text,
  type         text        not null default 'general' check (type in ('general', 'bug', 'feature', 'praise')),
  message      text        not null,
  created_at   timestamptz not null default now()
);

-- No RLS — this table is write-only from the service-role key (server-side API).
-- The admin reads it via the Supabase dashboard or a future /admin/feedback page.
alter table public.us_feedback enable row level security;

-- Service role can do everything (used by the API route)
create policy "service_role_all" on public.us_feedback
  for all using (auth.role() = 'service_role');
