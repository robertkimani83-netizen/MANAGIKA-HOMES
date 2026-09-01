-- Lightweight tenant screening / reference checks (Sep 1, 2026)
--
-- WHY: several competitor platforms offer some form of tenant vetting
-- before a landlord commits to a new tenant; Managika had none. This is
-- deliberately NOT a credit-bureau integration (that needs a real
-- commercial contract with a Kenyan CRB, not something buildable in an
-- afternoon) - it's a structured place for the landlord to log what they
-- already do informally: ID number, a previous landlord's contact, an
-- employer, and their own notes/recommendation, before deciding to add
-- someone as an actual tenant. Purely the landlord's own working notes -
-- never shown to the tenant, never linked to the tenants table directly.
--
-- IMPORTANT - READ BEFORE RUNNING: written by reading the app's existing
-- schema/patterns, not the live database - please skim before running on
-- production data, same caveat as every other migration here.

create table if not exists tenant_screenings (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone_number text,
  id_number text,
  employer text,
  previous_landlord_name text,
  previous_landlord_phone text,
  notes text,
  recommendation text not null default 'pending' check (recommendation in ('pending', 'proceed', 'caution', 'decline')),
  converted_to_tenant boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tenant_screenings_landlord_id_idx on tenant_screenings(landlord_id);

alter table tenant_screenings enable row level security;

drop policy if exists "Landlords manage own screenings" on tenant_screenings;
create policy "Landlords manage own screenings"
on tenant_screenings for all
using (landlord_id = auth.uid())
with check (landlord_id = auth.uid());
