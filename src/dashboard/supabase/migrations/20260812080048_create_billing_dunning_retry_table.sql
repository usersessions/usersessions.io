create table if not exists us_billing_dunning (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references us_clients(id) not null,
  invoice_reference text not null,
  paystack_invoice_code text,
  amount_kobo integer,
  attempt integer not null default 0,  -- 0=initial, 1=day3, 2=day7, 3=day14
  status text not null default 'pending', -- pending | resolved | escalated_manual
  next_retry_at timestamptz,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Enable RLS (admin only)
alter table us_billing_dunning enable row level security;

-- Admin can read/write everything (similar to other system tables)
create policy "Service role has full access to us_billing_dunning"
  on us_billing_dunning
  using (true)
  with check (true);
