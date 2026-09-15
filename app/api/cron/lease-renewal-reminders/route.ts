import { NextResponse } from "next/server";
import AfricasTalking from "africastalking";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";

function toKenyanFormat(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0")) return "+254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "+254" + digits;
  return "+" + digits;
}

// Runs daily (see vercel.json). Tells the LANDLORD, not the tenant, that a
// lease is coming up for renewal - a landlord decides whether to renew,
// raise rent, or give notice, so they're the one who needs the heads-up.
// Fires once per lease_end_date: lease_renewal_reminded_at gets set below,
// and the tenant-detail page clears it back to null whenever a landlord
// edits the dates (e.g. after actually renewing), so the next expiry gets
// its own reminder instead of this going silent forever.
//
// WhatsApp isn't used here - unlike rent_reminder/payment_confirmation,
// there's no Meta-approved WhatsApp template for a lease-renewal message,
// and sending an unapproved freeform template fails outright. SMS only,
// same Africa's Talking setup as the rent-reminder cron, until/unless a
// template for this gets submitted and approved.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret || !secureCompare(authHeader, "Bearer " + cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 30);
    const windowEndIso = windowEnd.toISOString().slice(0, 10);

    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from("tenants")
      .select("id, full_name, landlord_id, lease_end_date, units(unit_number, properties(property_name))")
      .eq("status", "active")
      .not("lease_end_date", "is", null)
      .is("lease_renewal_reminded_at", null)
      .lte("lease_end_date", windowEndIso);

    if (tenantsError) {
      return NextResponse.json({ error: tenantsError.message }, { status: 500 });
    }

    const africastalking = AfricasTalking({
      apiKey: process.env.AFRICASTALKING_API_KEY as string,
      username: process.env.AFRICASTALKING_USERNAME as string,
    });
    const sms = africastalking.SMS;
    const senderId = process.env.AFRICASTALKING_SENDER_ID;

    let remindersSent = 0;
    const errors: string[] = [];

    for (const tenant of (tenants || []) as any[]) {
      if (!tenant.landlord_id) continue;

      const { data: landlord } = await supabaseAdmin
        .from("landlords")
        .select("phone_number")
        .eq("id", tenant.landlord_id)
        .maybeSingle();

      if (!landlord?.phone_number) {
        errors.push(tenant.full_name + ": landlord has no phone number on file");
        continue;
      }

      const unitLabel = tenant.units
        ? tenant.units.properties?.property_name + " Unit " + tenant.units.unit_number
        : "their unit";

      const message =
        "Managika Homes: " +
        tenant.full_name +
        "'s lease at " +
        unitLabel +
        " ends on " +
        tenant.lease_end_date +
        ". Decide on renewal, a new rate, or notice, and update it in their tenant profile.";

      try {
        await sms.send({ to: [toKenyanFormat(landlord.phone_number)], message, ...(senderId ? { from: senderId } : {}) });
        remindersSent++;
      } catch (smsError: any) {
        errors.push(tenant.full_name + ": SMS failed - " + (smsError.message || "unknown error"));
        continue;
      }

      await supabaseAdmin
        .from("tenants")
        .update({ lease_renewal_reminded_at: new Date().toISOString() })
        .eq("id", tenant.id);
    }

    return NextResponse.json({ success: true, checked: (tenants || []).length, remindersSent, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Cron job failed" }, { status: 500 });
  }
}
