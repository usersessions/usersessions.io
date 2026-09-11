-- Migration: 0079_demo_requests.sql
-- Creates us_demo_requests for demo-gated access control

create type demo_request_status as enum ('pending', 'approved', 'rejected');

create table us_demo_requests (
  id              uuid primary key default uuid_generate_v4(),
  email           text not null,
  full_name       text not null,
  company         text not null,
  role            text not null,
  current_tool    text not null,
  team_size       text not null,
  status          demo_request_status not null default 'approved',
  notes           text,
  created_at      timestamp with time zone default timezone('utc'::text, now()) not null,
  approved_at     timestamp with time zone,
  reviewed_by     text
);

-- Fast allowlist lookups on login
create unique index us_demo_requests_email_idx on us_demo_requests (lower(email));
create index us_demo_requests_status_idx on us_demo_requests (status);
create index us_demo_requests_created_at_idx on us_demo_requests (created_at desc);

-- RLS — service role only; no public reads
alter table us_demo_requests enable row level security;

create policy "Service role full access to demo requests"
  on us_demo_requests
  for all
  using (true)
  with check (true);

-- Helper function: check if email is on the approved demo list
create or replace function is_demo_approved(p_email text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from us_demo_requests
    where lower(email) = lower(p_email)
      and status = 'approved'
  );
$$;
