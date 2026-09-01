-- Phone-only tenants blocked by RLS on complaints/announcements/documents/
-- inspections (Sep 1, 2026)
--
-- WHY: app/api/tenants/signup-phone/route.ts lets a tenant with no email on
-- file (bulk-imported by their landlord) create a portal account that signs
-- in with a PHONE number, not an email - a fully supported, working path
-- (see app/tenant/login/page.tsx). But every tenant-facing RLS policy added
-- by supabase/migrations/2026_08_27_new_features_and_complaints_rls.sql
-- matches ONLY on:
--     tenants.email = (auth.jwt() ->> 'email')
-- For a phone-only tenant, auth.jwt() ->> 'email' is null, so
-- `tenants.email = null` is never true in SQL and the policy denies access
-- outright - regardless of what the application code does. Concretely,
-- today, a phone-only tenant's own dashboard queries for complaints,
-- announcements, documents, and move-in/move-out inspections silently
-- return zero rows, even though everything they're asking for is theirs.
-- (Their own `tenants` row, invoices, maintenance_requests, and payments
-- are unaffected by this migration - those RLS policies live elsewhere
-- and, going by the app's existing behavior for phone-only tenants, appear
-- to already account for phone auth; worth a quick look at their
-- definitions in the Supabase dashboard to confirm the same way this file
-- confirms the four below.)
--
-- IMPORTANT - READ BEFORE RUNNING:
-- 1. Written by reading the Next.js/TypeScript code and the two existing
--    migrations in this folder, NOT the live database schema - no Supabase
--    dashboard/SQL access from this sandbox. Please skim before running on
--    production data, same caveat as the other files here.
-- 2. Supabase stores auth.users.phone in E.164 WITHOUT a leading "+" (e.g.
--    "254712345678"), matching what app/api/tenants/link-phone/route.ts and
--    signup-phone/route.ts write via phone_confirm. The tenants.phone_number
--    column, by contrast, holds whatever format the landlord originally
--    typed or bulk-imported (07XXXXXXXX, 254XXXXXXXXX, +254XXXXXXXXX) - see
--    lib/tenant-phone.ts's phoneVariants(). Each policy below checks all
--    three shapes against auth.jwt() ->> 'phone', the same way phoneVariants
--    does in application code, so it matches regardless of which format a
--    given tenant row happens to be stored in.
-- 3. Idempotent (DROP POLICY IF EXISTS, then CREATE) and additive only -
--    every policy below is dropped and recreated with the SAME name it
--    already has, just with an "or phone" branch added. Nothing else about
--    these tables or their other policies changes.

-- ── complaints ───────────────────────────────────────────────────────
drop policy if exists "Tenants can view own complaints" on complaints;
create policy "Tenants can view own complaints"
on complaints for select
using (
  exists (
    select 1 from tenants
    where tenants.id = complaints.tenant_id
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

drop policy if exists "Tenants can submit own complaints" on complaints;
create policy "Tenants can submit own complaints"
on complaints for insert
with check (
  exists (
    select 1 from tenants
    where tenants.id = complaints.tenant_id
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

-- ── announcements ────────────────────────────────────────────────────
drop policy if exists "Tenants can view their landlord's announcements" on announcements;
create policy "Tenants can view their landlord's announcements"
on announcements for select
using (
  exists (
    select 1 from tenants
    where tenants.landlord_id = announcements.landlord_id
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

-- ── documents ────────────────────────────────────────────────────────
drop policy if exists "Tenants can view own documents" on documents;
create policy "Tenants can view own documents"
on documents for select
using (
  exists (
    select 1 from tenants
    where tenants.id = documents.tenant_id
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

-- ── unit_inspections ─────────────────────────────────────────────────
drop policy if exists "Tenants can view own inspections" on unit_inspections;
create policy "Tenants can view own inspections"
on unit_inspections for select
using (
  exists (
    select 1 from tenants
    where tenants.id = unit_inspections.tenant_id
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
