-- Paybill details a landlord's tenants are told to pay to, so rent reminders
-- (SMS and WhatsApp) and the tenant dashboard can say
-- "Paybill 222111, Account 27833#A14".
--   paybill_number  the Paybill (business) number, digits only
--   paybill_account the fixed part of the account, before the "#"; the tenant's
--                   unit number is added after it ("27833" + "#" + "A14").
-- Both are optional. A landlord who leaves paybill_number empty gets the
-- reminders exactly as before.
alter table public.landlord_payment_settings
  add column if not exists paybill_number text,
  add column if not exists paybill_account text;
