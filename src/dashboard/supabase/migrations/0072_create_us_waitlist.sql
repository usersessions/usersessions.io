-- Phase 0: Waitlist table
create table us_waitlist (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  company text not null,
  current_tool text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table us_waitlist enable row level security;

-- Only service role can read/insert (API route uses service role)
create policy "Service role can insert waitlist"
  on us_waitlist
  for insert
  with check (true);

create policy "Service role can read waitlist"
  on us_waitlist
  for select
  using (true);
