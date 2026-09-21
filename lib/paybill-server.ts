import { supabaseAdmin } from "@/lib/supabase-admin";
import { toPaybillInfo, type PaybillInfo } from "@/lib/paybill";

// The landlord's Paybill details, or null when none are set. A lookup that
// fails also returns null: the reminder then goes out without payment
// instructions instead of not going out at all.
export async function loadPaybillInfo(landlordId: string | null | undefined): Promise<PaybillInfo | null> {
  if (!landlordId) return null;
  const { data, error } = await supabaseAdmin
    .from("landlord_payment_settings")
    .select("paybill_number, paybill_account")
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (error) return null;
  return toPaybillInfo(data);
}
