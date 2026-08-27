-- New features (Announcements, Documents, Move-in/Move-out inspections)
-- plus a fix for a complaints IDOR found while building them (Aug 27, 2026)
--
-- IMPORTANT - READ BEFORE RUNNING:
-- 1. Written by reading the Next.js/TypeScript code, NOT the live database
--    schema - no Supabase dashboard/SQL access from this sandbox. Column
--    names for EXISTING tables (properties, units, tenants, complaints)
--    are taken from the app's existing queries and should be correct;
--    double check them against your actual schema before running.
-- 2. Tenants authenticate by email, not by a user_id column on `tenants`
--    (confirmed in app/tenant/dashboard/page.tsx: tenants are looked up via
--    .eq("email", auth user's email)). So every tenant-facing RLS policy
--    below matches on auth.jwt() ->> 'email' = tenants.email, not auth.uid().
-- 3. This is additive only - it does not touch any existing table or policy
--    beyond the complaints fix called out below.

-- =====================================================================
-- 1. COMPLAINTS FIX
--
-- WHY: app/complaints/page.tsx (before today's fix) read and updated the
-- complaints table with NO ownership filter at all - any logged-in
-- landlord could view every other landlord's tenant complaints (private
-- text) and change any complaint's status by guessing/incrementing an id.
-- The app code has been fixed (scoped SELECT + a server-side PATCH route
-- with an ownership check), but the underlying protection is this RLS
-- policy - without it, anyone with the anon key and a valid landlord
-- session can still call the Supabase client directly and bypass the
-- app's own queries entirely.
-- =====================================================================

alter table complaints enable row level security;

drop policy if exists "Landlords can view own tenants' complaints" on complaints;
create policy "Landlords can view own tenants' complaints"
on complaints for select
using (
  exists (
    select 1 from units
    join properties on properties.id = units.property_id
    where units.id = complaints.unit_id
      and properties.landlord_id = auth.uid()
  )
);

drop policy if exists "Landlords can update own tenants' complaints" on complaints;
create policy "Landlords can update own tenants' complaints"
on complaints for update
using (
  exists (
    select 1 from units
    join properties on properties.id = units.property_id
    where units.id = complaints.unit_id
      and properties.landlord_id = auth.uid()
  )
);

-- Tenants can view and submit their own complaints (matches existing
-- tenant-dashboard behavior - this only ADDS a policy, it doesn't touch
-- anything tenant-facing that may already exist).
drop policy if exists "Tenants can view own complaints" on complaints;
create policy "Tenants can view own complaints"
on complaints for select
using (
  exists (
    select 1 from tenants
    where tenants.id = complaints.tenant_id
      and tenants.email = (auth.jwt() ->> 'email')
  )
);

drop policy if exists "Tenants can submit own complaints" on complaints;
create policy "Tenants can submit own complaints"
on complaints for insert
with check (
  exists (
    select 1 from tenants
    where tenants.id = complaints.tenant_id
      and tenants.email = (auth.jwt() ->> 'email')
  )
);

-- =====================================================================
-- 2. ANNOUNCEMENTS
-- =====================================================================

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'other' check (category in ('water', 'electricity', 'rent', 'security', 'garbage', 'other')),
  created_at timestamptz not null default now()
);

create index if not exists announcements_landlord_id_idx on announcements(landlord_id);

alter table announcements enable row level security;

drop policy if exists "Landlords manage own announcements" on announcements;
create policy "Landlords manage own announcements"
on announcements for all
using (landlord_id = auth.uid())
with check (landlord_id = auth.uid());

-- Tenants can read announcements posted by their own landlord.
drop policy if exists "Tenants can view their landlord's announcements" on announcements;
create policy "Tenants can view their landlord's announcements"
on announcements for select
using (
  exists (
    select 1 from tenants
    where tenants.email = (auth.jwt() ->> 'email')
      and tenants.landlord_id = announcements.landlord_id
  )
);

-- =====================================================================
-- 3. DOCUMENTS
--
-- Storage: a private "documents" bucket. All reads/writes to it go
-- through server API routes using the service-role key (see
-- app/api/documents/*), which check ownership before touching storage or
-- this table - so no storage.objects policies are needed for
-- authenticated/anon roles; the bucket being private + no permissive
-- policy means only server code with the service role key can reach it.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  document_type text not null default 'other' check (document_type in ('lease', 'receipt', 'deposit', 'inspection', 'notice', 'other')),
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists documents_landlord_id_idx on documents(landlord_id);
create index if not exists documents_tenant_id_idx on documents(tenant_id);

alter table documents enable row level security;

-- These policies protect the metadata table only. The actual files are
-- fetched exclusively through server API routes (signed URLs, service
-- role), so this is defense-in-depth for the row data (file names, which
-- tenant a document belongs to) rather than the only protection.
drop policy if exists "Landlords manage own documents" on documents;
create policy "Landlords manage own documents"
on documents for all
using (landlord_id = auth.uid())
with check (landlord_id = auth.uid());

drop policy if exists "Tenants can view own documents" on documents;
create policy "Tenants can view own documents"
on documents for select
using (
  exists (
    select 1 from tenants
    where tenants.id = documents.tenant_id
      and tenants.email = (auth.jwt() ->> 'email')
  )
);

-- =====================================================================
-- 4. MOVE-IN / MOVE-OUT INSPECTIONS
--
-- Photos ride on the same "documents" table/bucket built above (uploaded
-- with document_type='inspection') rather than a separate storage path
-- column, so viewing/securing an inspection photo reuses the exact same
-- ownership-checked signed-url route (app/api/documents/[id]/url) instead
-- of a second copy of that logic. photo_document_ids is a plain uuid array
-- (not a real foreign key - Postgres doesn't support FK arrays), it just
-- stores which documents.id rows belong to this inspection.
-- =====================================================================

create table if not exists unit_inspections (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null check (type in ('move_in', 'move_out')),
  electricity_meter_reading text,
  water_meter_reading text,
  keys_issued integer,
  condition_notes text,
  photo_document_ids uuid[] not null default '{}',
  deposit_amount numeric(12, 2),
  deposit_refund_amount numeric(12, 2),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists unit_inspections_landlord_id_idx on unit_inspections(landlord_id);
create index if not exists unit_inspections_tenant_id_idx on unit_inspections(tenant_id);

alter table unit_inspections enable row level security;

drop policy if exists "Landlords manage own inspections" on unit_inspections;
create policy "Landlords manage own inspections"
on unit_inspections for all
using (landlord_id = auth.uid())
with check (landlord_id = auth.uid());

drop policy if exists "Tenants can view own inspections" on unit_inspections;
create policy "Tenants can view own inspections"
on unit_inspections for select
using (
  exists (
    select 1 from tenants
    where tenants.id = unit_inspections.tenant_id
      and tenants.email = (auth.jwt() ->> 'email')
  )
);
