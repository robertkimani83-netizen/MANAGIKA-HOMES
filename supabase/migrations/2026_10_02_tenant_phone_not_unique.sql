-- Allow one person to rent more than one house: the same name and phone
-- number can now be on two tenant records (one per house). Before, the
-- unique rule on phone_number made "Save anyway" on the Add Tenant form fail.
--
-- Each house stays its own tenant record, so rent, balances and the bank
-- SMS "#unit" matching stay separate per house. Code that finds a tenant by
-- phone/login (tenant app, STK push, password reset) now picks the earliest
-- record instead of failing when there are two.
--
-- Email stays unique: leave email blank on the second house's record.

alter table public.tenants drop constraint if exists tenants_phone_number_key;
create index if not exists tenants_phone_number_idx on public.tenants (phone_number);
