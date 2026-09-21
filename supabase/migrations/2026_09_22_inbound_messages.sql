-- Messages a tenant sends from their own phone (WhatsApp or SMS) instead of the
-- app. Every message from a number saved on a tenant lands in tenant_messages
-- for that tenant's landlord (their Messages page). A message that starts with
-- COMPLAINT is also filed as a normal complaint on the Complaints page.
--   channel      'whatsapp' or 'sms'
--   kind         'complaint' or 'message'
--   external_id  the WhatsApp message id (or a fingerprint of the SMS), so a
--                message the sender re-delivers is only stored once
-- Rows are written only by the server (service role). A landlord can read
-- their own tenants' messages and mark them read, nothing else.

alter table public.complaints
  add column if not exists source text,
  add column if not exists external_id text;

create unique index if not exists complaints_external_id_key
  on public.complaints (external_id)
  where external_id is not null;

create table if not exists public.tenant_messages (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'sms')),
  kind text not null default 'message' check (kind in ('message', 'complaint')),
  body text not null,
  external_id text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tenant_messages_landlord_created_idx
  on public.tenant_messages (landlord_id, created_at desc);

alter table public.tenant_messages enable row level security;

drop policy if exists "Landlords read own tenants' messages" on public.tenant_messages;
create policy "Landlords read own tenants' messages"
  on public.tenant_messages for select
  to authenticated
  using (landlord_id = auth.uid());

drop policy if exists "Landlords mark own tenants' messages read" on public.tenant_messages;
create policy "Landlords mark own tenants' messages read"
  on public.tenant_messages for update
  to authenticated
  using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

-- Only the read flag can be changed from the browser.
revoke all on public.tenant_messages from anon, authenticated;
grant select on public.tenant_messages to authenticated;
grant update (read_at) on public.tenant_messages to authenticated;
