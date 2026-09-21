-- Per-landlord rent reminder rules, so the wording of SMS and WhatsApp
-- reminders matches each landlord's own rules instead of a fixed "due by the
-- 5th ... avoid penalties".
--   reminder_due_day    day of the month rent is due (1-28). NULL = the 5th.
--   reminder_penalties  whether late payment has penalties. NULL = yes.
-- Both are optional; a landlord who sets nothing keeps today's wording.
alter table public.landlord_payment_settings
  add column if not exists reminder_due_day smallint check (reminder_due_day between 1 and 28),
  add column if not exists reminder_penalties boolean;
