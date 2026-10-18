-- Follow-up to 2026_10_02_rls_performance.sql. After that migration a
-- landlord's invoices query still took ~0.7s, because the TENANT-side
-- policies below called current_tenant_id() / tenant_unit_id() /
-- tenant_property_id() once per row - and each of those scans the tenants
-- table and normalises every phone number. Wrapping the call in (select ...)
-- makes Postgres evaluate it once per statement. Same conditions as before.

drop policy if exists "Tenants can view own unit" on public.units;
create policy "Tenants can view own unit" on public.units
  for select to public
  using (id = (select tenant_unit_id()));

drop policy if exists "Tenants can view own property" on public.properties;
create policy "Tenants can view own property" on public.properties
  for select to public
  using (id = (select tenant_property_id()));

drop policy if exists "Tenants manage own complaints" on public.complaints;
create policy "Tenants manage own complaints" on public.complaints
  for all to public
  using (tenant_id = (select current_tenant_id()))
  with check (tenant_id = (select current_tenant_id()));

drop policy if exists "Tenants can manage own maintenance" on public.maintenance_requests;
create policy "Tenants can manage own maintenance" on public.maintenance_requests
  for all to public
  using (tenant_id = (select current_tenant_id()))
  with check (tenant_id = (select current_tenant_id()));
