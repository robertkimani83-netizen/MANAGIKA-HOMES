-- Lets the landlord mark an entry on the "Unmatched bank SMS" page as
-- handled (payment recorded by hand, or the message was not a rent payment).
-- Purely additive: existing rows default to unresolved, and the webhook
-- keeps working whether or not this has been run yet.
--
-- Run this in the Supabase SQL Editor.

alter table sms_payment_log
  add column if not exists resolved boolean not null default false;

alter table sms_payment_log
  add column if not exists resolved_at timestamptz;
