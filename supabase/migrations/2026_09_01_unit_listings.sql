-- Vacancy listings (Sep 1, 2026)
--
-- WHY: right now a vacant unit is just a status flag - nothing a landlord
-- can turn into something shareable to fill it faster. This adds a
-- lightweight public listing per unit (headline, description, contact
-- number, photos) that a landlord can share as a link (WhatsApp, a
-- Facebook post, wherever) without needing anyone to log in to view it.
--
-- Deliberately a NEW table and a NEW storage bucket rather than reusing
-- the existing "documents" table/bucket: documents.tenant_id is NOT
-- NULL (every document belongs to a specific tenant), but a vacancy
-- listing exists precisely because there's no tenant yet. The photos
-- bucket is also a different trust level on purpose - documents are
-- private (leases, receipts), listing photos are meant to be public by
-- design, the same way a "For Rent" photo would be on any listings site.
--
-- IMPORTANT - READ BEFORE RUNNING: written by reading the app's existing
-- schema/patterns, not the live database - please skim before running on
-- production data, same caveat as every other migration here.

create table if not exists unit_listings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null unique references units(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  headline text,
  description text,
  contact_phone text,
  photo_paths text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists unit_listings_landlord_id_idx on unit_listings(landlord_id);

alter table unit_listings enable row level security;

drop policy if exists "Landlords manage own listings" on unit_listings;
create policy "Landlords manage own listings"
on unit_listings for all
using (landlord_id = auth.uid())
with check (landlord_id = auth.uid());

-- A published listing is meant to be public, by design - no auth
-- required to view it, matching what a real vacancy ad is for.
drop policy if exists "Anyone can view published listings" on unit_listings;
create policy "Anyone can view published listings"
on unit_listings for select
using (is_published = true);

-- Public bucket: listing photos are meant to be viewable by anyone with
-- the link, unlike the private "documents" bucket. Uploads still only
-- happen through the authenticated server route (app/api/listings/photo)
-- which verifies the caller owns the unit before writing anything here.
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do update set public = true;
