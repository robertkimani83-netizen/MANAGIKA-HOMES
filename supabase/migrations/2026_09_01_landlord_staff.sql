-- Caretaker / staff read-only access (Sep 1, 2026)
--
-- WHY: the marketing site promises "no record a new caretaker or family
-- member can pick up" as a problem Managika solves, but until now there
-- was exactly one login per landlord - nothing a caretaker or family
-- member could be given access to. This migration adds the table behind
-- that promise: a landlord can invite someone to a READ-ONLY view of
-- their units/tenants/payments/maintenance/complaints (who's paid, who's
-- overdue, what needs fixing) without handing out their own password.
--
-- DESIGN NOTE: staff access is deliberately NOT implemented as new RLS
-- policies on tenants/units/payments/etc (that would mean touching every
-- existing policy in the app, on live production data, which is a much
-- higher-risk change). Instead, staff data access goes through dedicated
-- server API routes (app/api/staff/*) using the service-role key, the
-- same "verify ownership server-side, then use supabaseAdmin" pattern
-- already used everywhere else sensitive in this app (maintenance,
-- units, documents, etc). This table and its RLS only cover the
-- landlord_staff row itself - never the underlying tenant/payment data.
--
-- IMPORTANT - READ BEFORE RUNNING: written by reading the app's existing
-- schema/patterns, not the live database - please skim before running on
-- production data, same caveat as every other migration here.

create table if not exists landlord_staff (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  invite_token text unique,
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists landlord_staff_landlord_id_idx on landlord_staff(landlord_id);
create index if not exists landlord_staff_auth_user_id_idx on landlord_staff(auth_user_id);

alter table landlord_staff enable row level security;

-- Landlord manages their own staff list (invite, view, revoke). Looking
-- up an invite by token during signup, and all actual tenant/payment
-- data access, both go through service-role API routes instead - this
-- policy is only for the landlord's own "Team" page.
drop policy if exists "Landlords manage own staff" on landlord_staff;
create policy "Landlords manage own staff"
on landlord_staff for all
using (landlord_id = auth.uid())
with check (landlord_id = auth.uid());

-- A staff member can see their own row (e.g. to confirm which landlord
-- they're linked to) once auth_user_id is set.
drop policy if exists "Staff can view own membership" on landlord_staff;
create policy "Staff can view own membership"
on landlord_staff for select
using (auth_user_id = auth.uid());
