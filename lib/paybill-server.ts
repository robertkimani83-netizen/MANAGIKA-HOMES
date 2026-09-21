import { supabaseAdmin } from "@/lib/supabase-admin";
import { toPaybillInfo, type PaybillInfo } from "@/lib/paybill";
import { toReminderRules, type ReminderRules } from "@/lib/reminder-rules";

export type LandlordReminderSettings = { paybill: PaybillInfo | null; rules: ReminderRules };

// Everything a rent reminder needs to know about the landlord: the Paybill
// they collect on (or null) and their own due day / penalty rules. A lookup
// that fails falls back to "no Paybill, the 5th, penalties": the reminder
// then goes out with the standard wording instead of not going out at all.
export async function loadReminderSettings(landlordId: string | null | undefined): Promise<LandlordReminderSettings> {
  const fallback: LandlordReminderSettings = { paybill: null, rules: toReminderRules(null) };
  if (!landlordId) return fallback;
  const { data, error } = await supabaseAdmin
    .from("landlord_payment_settings")
    .select("paybill_number, paybill_account, reminder_due_day, reminder_penalties")
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (error) return fallback;
  return { paybill: toPaybillInfo(data), rules: toReminderRules(data) };
}

// The landlord's Paybill details, or null when none are set.
export async function loadPaybillInfo(landlordId: string | null | undefined): Promise<PaybillInfo | null> {
  return (await loadReminderSettings(landlordId)).paybill;
}
