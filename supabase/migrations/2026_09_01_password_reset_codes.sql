-- Backs the phone-based password reset flow for tenants who signed up
-- with a phone number instead of an email (see
-- app/api/tenants/reset-password-phone/*). Only ever touched via the
-- service-role key from those two routes, never from client code.

create table if not exists password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  code text not null,
  attempts integer not null default 0,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_codes_phone_idx on password_reset_codes (phone_number);

alter table password_reset_codes enable row level security;
-- Deliberately zero policies: RLS with no policies means anon/authenticated
-- callers get no access at all if this table is ever queried directly via
-- supabase-js. It's only ever read/written through supabaseAdmin
-- (service-role key) inside the two API routes above.
