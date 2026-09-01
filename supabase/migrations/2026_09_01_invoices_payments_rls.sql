-- Invoices/payments RLS - the last two tables touched directly from the
-- browser (anon key) that had no Row Level Security at all (Sep 1, 2026)
--
-- WHY: app/payments/page.tsx (landlord) and app/tenant/dashboard/page.tsx
-- (tenant) both read and write the `invoices` and `payments` tables
-- directly through the browser's Supabase client - not through a server
-- API route. Every other table reached this way (tenants, units,
-- maintenance_requests, complaints, announcements, documents,
-- unit_inspections) already has RLS from the two Aug 27 migrations plus
-- today's phone-auth migration. invoices/payments were missed - neither
-- file touches them, and there is no earlier migration for them either.
--
-- Concretely, right now, if RLS is genuinely off on these two tables (the
-- normal state for a table nobody has ever run "alter table ... enable
-- row level security" on), any logged-in landlord or tenant can open the
-- browser console and:
--   - supabase.from("invoices").select("*")  -> every invoice for every
--     landlord's every tenant: rent amounts, billing periods, balances.
--   - supabase.from("payments").select("*")  -> every payment record
--     anyone has ever made, across the whole app.
--   - supabase.from("invoices").update({status:"paid"}).eq("id", anyId)
--     -> mark ANY landlord's invoice paid/unpaid, not just their own.
--   - supabase.from("payments").insert({invoice_id: anyId, ...})
--     -> attach a fabricated payment to any invoice.
-- The app's own UI never does any of this (it always scopes tenantId to
-- the landlord's own list first), but nothing stops someone from calling
-- the same client directly with a different id - the app code was never
-- the actual protection, RLS is.
--
-- IMPORTANT - READ BEFORE RUNNING:
-- 1. Written by reading the Next.js/TypeScript code, NOT the live
--    database schema - no Supabase dashboard access from this sandbox.
--    Column names (tenant_id, invoice_id, landlord_id via tenants) are
--    taken directly from the app's existing queries. Please skim before
--    running on production data.
-- 2. Idempotent (DROP POLICY IF EXISTS, then CREATE) and additive only.
-- 3. Deliberately NOT adding a delete policy on either table - nothing in
--    the app deletes an invoice or payment, so leaving delete ungranted
--    (RLS defaults to deny) is safer than guessing at a policy nobody
--    tested. If you ever need to delete one from the dashboard, use the
--    Supabase table editor (it runs as an admin, RLS doesn't apply there)
--    or ask for a proper delete route/policy to be added.
-- 4. The tenant-facing phone match uses the same three-shape check as
--    today's other migration (raw digits, "+" prefixed, local "0..."
--    format) so it matches regardless of how a tenant's phone_number is
--    stored.

-- ── invoices ─────────────────────────────────────────────────────────
alter table invoices enable row level security;

drop policy if exists "Landlords can view own tenants' invoices" on invoices;
create policy "Landlords can view own tenants' invoices"
on invoices for select
using (
  exists (
    select 1 from tenants
    where tenants.id = invoices.tenant_id
      and tenants.landlord_id = auth.uid()
  )
);

drop policy if exists "Landlords can create invoices for own tenants" on invoices;
create policy "Landlords can create invoices for own tenants"
on invoices for insert
with check (
  exists (
    select 1 from tenants
    where tenants.id = invoices.tenant_id
      and tenants.landlord_id = auth.uid()
  )
);

drop policy if exists "Landlords can update own tenants' invoices" on invoices;
create policy "Landlords can update own tenants' invoices"
on invoices for update
using (
  exists (
    select 1 from tenants
    where tenants.id = invoices.tenant_id
      and tenants.landlord_id = auth.uid()
  )
);

drop policy if exists "Tenants can view own invoices" on invoices;
create policy "Tenants can view own invoices"
on invoices for select
using (
  exists (
    select 1 from tenants
    where tenants.id = invoices.tenant_id
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

-- ── payments ─────────────────────────────────────────────────────────
alter table payments enable row level security;

drop policy if exists "Landlords can view own tenants' payments" on payments;
create policy "Landlords can view own tenants' payments"
on payments for select
using (
  exists (
    select 1 from invoices
    join tenants on tenants.id = invoices.tenant_id
    where invoices.id = payments.invoice_id
      and tenants.landlord_id = auth.uid()
  )
);

drop policy if exists "Landlords can record payments for own tenants" on payments;
create policy "Landlords can record payments for own tenants"
on payments for insert
with check (
  exists (
    select 1 from invoices
    join tenants on tenants.id = invoices.tenant_id
    where invoices.id = payments.invoice_id
      and tenants.landlord_id = auth.uid()
  )
);

drop policy if exists "Tenants can view own payments" on payments;
create policy "Tenants can view own payments"
on payments for select
using (
  exists (
    select 1 from invoices
    join tenants on tenants.id = invoices.tenant_id
    where invoices.id = payments.invoice_id
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
