-- Close two RLS gaps left open by earlier migrations (Sep 1, 2026)
--
-- WHY: while auditing the whole app, I found that no migration file in
-- this repo (checked every one, from 2026_08_27 onward) ever grants a
-- tenant permission to see their OWN row in the `tenants` table, or to
-- view/submit their OWN `maintenance_requests`. Both are things the app
-- does directly from the browser with the tenant's own logged-in session
-- (app/tenant/dashboard/page.tsx: an unfiltered `tenants` select relying
-- entirely on RLS, and a direct insert into `maintenance_requests`).
--
-- This isn't necessarily a live bug - these specific policies may already
-- exist in the database, created by hand at some point before this
-- migrations folder existed (the base `tenants`/`landlords`/`units`
-- tables themselves aren't created by any file here either, so this
-- folder was clearly never the full schema history). But maintenance_requests
-- specifically DID get its RLS set up by a migration in this repo
-- (2026_08_27_landlord_data_isolation_rls.sql, landlord-side only) with
-- no tenant-side follow-up ever added - unlike complaints/announcements/
-- documents/inspections/invoices/payments, which all got an explicit
-- tenant policy. That looks like a genuine miss, not an intentional gap.
--
-- Either way, running this is safe: every policy below is additive
-- (Postgres OR's multiple permissive policies on the same table together,
-- it never replaces one), scoped narrowly to "this row belongs to the
-- calling tenant" using the same email-or-phone match as every other
-- tenant-facing policy in this app, and uses DROP POLICY IF EXISTS so
-- it's fine to run again later too.
--
-- IMPORTANT - READ BEFORE RUNNING: written by reading the app's existing
-- schema/patterns, not the live database - please skim before running on
-- production data, same caveat as every other migration here.

-- ── tenants: a tenant can see their own row ─────────────────────────
drop policy if exists "Tenants can view own record" on tenants;
create policy "Tenants can view own record"
on tenants for select
using (
  tenants.email = (auth.jwt() ->> 'email')
  or (
    (auth.jwt() ->> 'phone') is not null
    and tenants.phone_number in (
      (auth.jwt() ->> 'phone'),
      ('+' || (auth.jwt() ->> 'phone')),
      ('0' || right((auth.jwt() ->> 'phone'), -3))
    )
  )
);

-- ── maintenance_requests: a tenant can view and submit their own ───
drop policy if exists "Tenants can view own maintenance requests" on maintenance_requests;
create policy "Tenants can view own maintenance requests"
on maintenance_requests for select
using (
  exists (
    select 1 from tenants
    where tenants.id = maintenance_requests.tenant_id
      and (
        tenants.email = (auth.jwt() ->> 'email')
        or (
          (auth.jwt() ->> 'phone') is not null
          and tenants.phone_number in (
            (auth.jwt() ->> 'phone'),
            ('+' || (auth.jwt() ->> 'phone')),
            ('0' || right((auth.jwt() ->> 'phone'), -3))
          )
        )
      )
  )
);

drop policy if exists "Tenants can submit own maintenance requests" on maintenance_requests;
create policy "Tenants can submit own maintenance requests"
on maintenance_requests for insert
with check (
  exists (
    select 1 from tenants
    where tenants.id = maintenance_requests.tenant_id
      and (
        tenants.email = (auth.jwt() ->> 'email')
        or (
          (auth.jwt() ->> 'phone') is not null
          and tenants.phone_number in (
            (auth.jwt() ->> 'phone'),
            ('+' || (auth.jwt() ->> 'phone')),
            ('0' || right((auth.jwt() ->> 'phone'), -3))
          )
        )
      )
  )
);

-- ── check_tenant_email: called by app/tenant/login/page.tsx before a
-- tenant has any session at all (it decides whether to let them sign up
-- with that email), but no definition for it exists anywhere in this
-- repo. If it's already defined in the database with equivalent
-- behavior, this simply replaces it with the same behavior - safe. If it
-- was never created, tenant email sign-up has been silently broken this
-- whole time (every email always looks "not registered"), and this is
-- what fixes it.
create or replace function check_tenant_email(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from tenants where email = check_email
  );
$$;

grant execute on function check_tenant_email(text) to anon, authenticated;
