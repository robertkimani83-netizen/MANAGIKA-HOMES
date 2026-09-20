-- Safety net for the SMS payment auto-confirm webhook
-- (app/api/sms-payment-webhook/route.ts).
--
-- Robert chose fully-automatic confirmation (no landlord tap-to-confirm
-- step) for payments matched by house/unit tag. This table exists so a
-- message that DOES pass the sender check but can't be parsed or matched
-- to a real unit/tenant (mistyped house tag, unusual message format, a
-- one-off family transaction through the same shared inbox, etc.) still
-- lands somewhere visible instead of vanishing silently.
--
-- Run this in the Supabase SQL Editor.

create table if not exists sms_payment_log (
  id uuid primary key default gen_random_uuid(),
  raw_message text not null,        -- full raw webhook body, for audit/debugging
  sender text,                      -- SMS sender as reported by the forwarder app
  message_text text,                -- just the SMS body text
  reason text not null,             -- e.g. message_not_parseable / no_matching_unit / no_active_tenant_for_unit / invoice_create_failed
  amount numeric,
  house_tag text,                   -- the "#D25"-style tag extracted, if any
  payer_name text,
  mpesa_ref text,
  created_at timestamptz not null default now()
);

-- Service-role only (no client-side policies) - same access pattern as
-- landlord_payment_settings: this table is written by the webhook route
-- using the service role key, and should only ever be read through a
-- server-side API route that checks landlord auth, never directly from
-- the browser with the anon key.
alter table sms_payment_log enable row level security;
