-- Speed up row-level security without changing who can see what.
--
-- Why: the Payments page started failing with "canceling statement due to
-- statement timeout" (8s limit for logged-in users) even though the whole
-- database is tiny (~150 invoices, ~55 payments). Timing one invoices query
-- as the landlord took ~0.7s for 139 rows, because:
--   1. The "Active subscription required" RESTRICTIVE policies called
--      landlord_has_active_subscription(auth.uid()) - a function that runs
--      its own query - once PER ROW, on every table in the request.
--   2. None of the columns joining tenants/invoices/payments/units had an
--      index, so every lookup scanned whole tables.
-- With ~10 such queries fired at once by the Payments page (more with the
-- page also open on a phone), the small database ran past the 8s limit.
--
-- Fix 1: indexes on the joining columns.
-- Fix 2: wrap auth.uid() and the subscription check in (select ...), which
-- Postgres evaluates ONCE per statement instead of once per row (Supabase's
-- documented RLS performance pattern). The conditions are logically the
-- same as before.

-- ---- 1. Indexes ----------------------------------------------------------
create index if not exists invoices_tenant_id_idx on public.invoices (tenant_id);
create index if not exists invoices_unit_id_idx on public.invoices (unit_id);
create index if not exists invoices_tenant_period_idx on public.invoices (tenant_id, billing_period);
create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists tenants_landlord_id_idx on public.tenants (landlord_id);
create index if not exists tenants_unit_id_idx on public.tenants (unit_id);
create index if not exists properties_landlord_id_idx on public.properties (landlord_id);
create index if not exists landlord_subscriptions_landlord_id_idx on public.landlord_subscriptions (landlord_id);
create index if not exists complaints_tenant_id_idx on public.complaints (tenant_id);
create index if not exists maintenance_requests_tenant_id_idx on public.maintenance_requests (tenant_id);

-- ---- 2. Subscription policies, evaluated once per statement --------------

-- Tables owned through a tenant
drop policy if exists "Active subscription required for landlord access" on public.invoices;
create policy "Active subscription required for landlord access" on public.invoices
  as restrictive for all to authenticated
  using ((tenant_owner_landlord_id(tenant_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))))
  with check ((tenant_owner_landlord_id(tenant_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))));

drop policy if exists "Active subscription required for landlord access" on public.complaints;
create policy "Active subscription required for landlord access" on public.complaints
  as restrictive for all to authenticated
  using ((tenant_owner_landlord_id(tenant_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))))
  with check ((tenant_owner_landlord_id(tenant_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))));

drop policy if exists "Active subscription required for landlord access" on public.maintenance_requests;
create policy "Active subscription required for landlord access" on public.maintenance_requests
  as restrictive for all to authenticated
  using ((tenant_owner_landlord_id(tenant_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))))
  with check ((tenant_owner_landlord_id(tenant_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))));

-- Payments (owned through their invoice)
drop policy if exists "Active subscription required for landlord access" on public.payments;
create policy "Active subscription required for landlord access" on public.payments
  as restrictive for all to authenticated
  using ((invoice_owner_landlord_id(invoice_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))))
  with check ((invoice_owner_landlord_id(invoice_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))));

-- Units (owned through their property)
drop policy if exists "Active subscription required for landlord access" on public.units;
create policy "Active subscription required for landlord access" on public.units
  as restrictive for all to authenticated
  using ((unit_owner_landlord_id(property_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))))
  with check ((unit_owner_landlord_id(property_id) is distinct from (select auth.uid())) or (select landlord_has_active_subscription((select auth.uid()))));

-- Tables with landlord_id directly. Before: (landlord_id <> uid) OR
-- has_sub(landlord_id). has_sub(landlord_id) only matters when
-- landlord_id = uid, so it is the same as has_sub(uid) there; written with an
-- explicit "landlord_id = uid AND ..." so a NULL landlord_id behaves exactly
-- as before (not visible).
drop policy if exists "Active subscription required for landlord access" on public.tenants;
create policy "Active subscription required for landlord access" on public.tenants
  as restrictive for all to authenticated
  using ((landlord_id <> (select auth.uid())) or (landlord_id = (select auth.uid()) and (select landlord_has_active_subscription((select auth.uid())))))
  with check ((landlord_id <> (select auth.uid())) or (landlord_id = (select auth.uid()) and (select landlord_has_active_subscription((select auth.uid())))));

drop policy if exists "Active subscription required for landlord access" on public.properties;
create policy "Active subscription required for landlord access" on public.properties
  as restrictive for all to authenticated
  using ((landlord_id <> (select auth.uid())) or (landlord_id = (select auth.uid()) and (select landlord_has_active_subscription((select auth.uid())))))
  with check ((landlord_id <> (select auth.uid())) or (landlord_id = (select auth.uid()) and (select landlord_has_active_subscription((select auth.uid())))));
