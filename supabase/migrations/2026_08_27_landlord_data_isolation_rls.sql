-- Landlord data-isolation hardening (Aug 27, 2026)
--
-- WHY: a code audit found that a few mutations rely entirely on
-- client-side checks (units delete, maintenance_requests update/delete,
-- the tenant detail page) rather than a server-side or database-level
-- ownership check. The app's pages now route the mutations through
-- server API routes that verify ownership before touching anything
-- (see app/api/units/[id]/route.ts and app/api/maintenance/[id]/route.ts),
-- but that's only real protection for calls that go through those
-- routes. Because the rest of the app queries Supabase directly from
-- the browser with the anon key, the ONLY thing that can stop someone
-- from opening the browser console and calling the Supabase client
-- directly with a different ID is Row Level Security enforced by
-- Postgres itself. This migration is that layer.
--
-- IMPORTANT - READ BEFORE RUNNING:
-- 1. This was written by reading the Next.js/TypeScript code, NOT the
--    actual live database schema - I do not have Supabase dashboard
--    access. Column names (landlord_id, property_id, unit_id, tenant_id)
--    are taken directly from the app's queries and should be correct,
--    but please skim this before running it on production data.
-- 2. Every statement below is idempotent (DROP POLICY IF EXISTS, then
--    CREATE) so it's safe to run even if some of these policies already
--    exist - it will not remove any EXISTING policy with a different
--    name, including whatever policy currently lets tenants see their
--    own record. It only ADDS/REPLACES the landlord-facing policies
--    named below.
-- 3. Run this in the Supabase SQL Editor. Consider testing on a copy of
--    the database first if you have one, since this affects who can see
--    real tenant/rent data.

-- ── tenants ──────────────────────────────────────────────────────────
alter table tenants enable row level security;

drop policy if exists "landlords_select_own_tenants" on tenants;
create policy "landlords_select_own_tenants" on tenants
  for select using (landlord_id = auth.uid());

drop policy if exists "landlords_insert_own_tenants" on tenants;
create policy "landlords_insert_own_tenants" on tenants
  for insert with check (landlord_id = auth.uid());

drop policy if exists "landlords_update_own_tenants" on tenants;
create policy "landlords_update_own_tenants" on tenants
  for update using (landlord_id = auth.uid());

drop policy if exists "landlords_delete_own_tenants" on tenants;
create policy "landlords_delete_own_tenants" on tenants
  for delete using (landlord_id = auth.uid());

-- ── units (ownership via property_id -> properties.landlord_id) ──────
alter table units enable row level security;

drop policy if exists "landlords_select_own_units" on units;
create policy "landlords_select_own_units" on units
  for select using (
    exists (select 1 from properties where properties.id = units.property_id and properties.landlord_id = auth.uid())
  );

drop policy if exists "landlords_insert_own_units" on units;
create policy "landlords_insert_own_units" on units
  for insert with check (
    exists (select 1 from properties where properties.id = units.property_id and properties.landlord_id = auth.uid())
  );

drop policy if exists "landlords_update_own_units" on units;
create policy "landlords_update_own_units" on units
  for update using (
    exists (select 1 from properties where properties.id = units.property_id and properties.landlord_id = auth.uid())
  );

drop policy if exists "landlords_delete_own_units" on units;
create policy "landlords_delete_own_units" on units
  for delete using (
    exists (select 1 from properties where properties.id = units.property_id and properties.landlord_id = auth.uid())
  );

-- ── maintenance_requests (ownership via unit_id -> units -> properties.landlord_id) ──
alter table maintenance_requests enable row level security;

drop policy if exists "landlords_select_own_maintenance" on maintenance_requests;
create policy "landlords_select_own_maintenance" on maintenance_requests
  for select using (
    exists (
      select 1 from units join properties on properties.id = units.property_id
      where units.id = maintenance_requests.unit_id and properties.landlord_id = auth.uid()
    )
  );

drop policy if exists "landlords_insert_own_maintenance" on maintenance_requests;
create policy "landlords_insert_own_maintenance" on maintenance_requests
  for insert with check (
    exists (
      select 1 from units join properties on properties.id = units.property_id
      where units.id = maintenance_requests.unit_id and properties.landlord_id = auth.uid()
    )
  );

drop policy if exists "landlords_update_own_maintenance" on maintenance_requests;
create policy "landlords_update_own_maintenance" on maintenance_requests
  for update using (
    exists (
      select 1 from units join properties on properties.id = units.property_id
      where units.id = maintenance_requests.unit_id and properties.landlord_id = auth.uid()
    )
  );

drop policy if exists "landlords_delete_own_maintenance" on maintenance_requests;
create policy "landlords_delete_own_maintenance" on maintenance_requests
  for delete using (
    exists (
      select 1 from units join properties on properties.id = units.property_id
      where units.id = maintenance_requests.unit_id and properties.landlord_id = auth.uid()
    )
  );

-- NOTE: these policies only cover the LANDLORD side. If tenants also
-- read their own tenant/maintenance rows directly via the anon key
-- (rather than through an API route), there should be a SEPARATE
-- existing policy for that (e.g. "tenants_select_own_row" using
-- something like id = auth.uid() or a tenant-auth-linkage column this
-- migration doesn't know about). This migration does not touch or
-- remove any such policy - only adds the landlord-facing ones above.
-- If tenant-side access breaks after running this, it means RLS was
-- previously OFF on one of these tables (so tenants were reading
-- through with no policy at all) rather than governed by a policy -
-- in that case a tenant-facing policy needs to be added too.
