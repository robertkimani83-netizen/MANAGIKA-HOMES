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

// Runs daily (see vercel.json). Texts a landlord about a preventive-
// maintenance task (app/maintenance-schedules) coming up within 7 days.
// Dedupe: last_reminded_at stores the due-date that was last reminded, so
// a schedule only fires once per cycle even though this runs every day -
// "Mark done" moves next_due_date forward, which makes last_reminded_at
// (the OLD due date) no longer match, so the next cycle reminds again on
// its own. SMS only, same reasoning as lease-renewal-reminders: no
// Meta-approved WhatsApp template exists for this message.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret || !secureCompare(authHeader, "Bearer " + cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + 7);
    const windowEndIso = windowEnd.toISOString().slice(0, 10);

    const { data: schedules, error: schedulesError } = await supabaseAdmin
      .from("maintenance_schedules")
      .select("id, landlord_id, title, next_due_date, last_reminded_at, units(unit_number, properties(property_name))")
      .lte("next_due_date", windowEndIso);

    if (schedulesError) {
      return NextResponse.json({ error: schedulesError.message }, { status: 500 });
    }

    const due = (schedules || []).filter((s: any) => s.last_reminded_at !== s.next_due_date);

    const africastalking = AfricasTalking({
      apiKey: process.env.AFRICASTALKING_API_KEY as string,
      username: process.env.AFRICASTALKING_USERNAME as string,
    });
    const sms = africastalking.SMS;
    const senderId = process.env.AFRICASTALKING_SENDER_ID;

    let remindersSent = 0;
    const errors: string[] = [];

    for (const schedule of due as any[]) {
      const { data: landlord } = await supabaseAdmin
        .from("landlords")
        .select("phone_number")
        .eq("id", schedule.landlord_id)
        .maybeSingle();

      if (!landlord?.phone_number) {
        errors.push(schedule.title + ": landlord has no phone number on file");
        continue;
      }

      const location = schedule.units
        ? schedule.units.properties?.property_name + " Unit " + schedule.units.unit_number
        : "a property";

      const message =
        "Managika Homes: \"" +
        schedule.title +
        "\" (" +
        location +
        ") is due " +
        schedule.next_due_date +
        ". Mark it done in Preventive Maintenance once it's handled.";

      try {
        await sms.send({ to: [toKenyanFormat(landlord.phone_number)], message, ...(senderId ? { from: senderId } : {}) });
        remindersSent++;
      } catch (smsError: any) {
        errors.push(schedule.title + ": SMS failed - " + (smsError.message || "unknown error"));
        continue;
      }

      await supabaseAdmin
        .from("maintenance_schedules")
        .update({ last_reminded_at: schedule.next_due_date })
        .eq("id", schedule.id);
    }

    return NextResponse.json({ success: true, checked: due.length, remindersSent, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Cron job failed" }, { status: 500 });
  }
}
