import { NextResponse } from "next/server";
import AfricasTalking from "africastalking";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";
import { normalizePhone } from "@/lib/tenant-phone";
import { buildWeeklySummary, formatSummarySms } from "@/lib/weekly-summary";

export const maxDuration = 60;

// Monday morning text to each landlord: what came in last week, who still
// owes, repairs and vacancies. It is OFF until WEEKLY_SUMMARY_SMS is set to
// "on" in Vercel (each SMS costs money, and the sender name must be approved
// first). The dashboard "This week" card works regardless.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret || !secureCompare(authHeader, "Bearer " + cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.WEEKLY_SUMMARY_SMS !== "on") {
    return NextResponse.json({ skipped: true, reason: "WEEKLY_SUMMARY_SMS is not on" });
  }

  try {
    const { data: subs, error: subsError } = await supabaseAdmin.from("landlord_subscriptions").select("landlord_id, status, trial_ends_at");
    if (subsError) return NextResponse.json({ error: subsError.message }, { status: 500 });

    const now = new Date();
    const eligibleIds = (subs || [])
      .filter((s: any) => s.status === "active" || (s.status === "trial" && (!s.trial_ends_at || new Date(s.trial_ends_at) > now)))
      .map((s: any) => s.landlord_id as string);
    if (eligibleIds.length === 0) return NextResponse.json({ success: true, sent: 0, skipped: 0, errors: [] });

    const { data: landlords, error: landlordsError } = await supabaseAdmin.from("landlords").select("id, full_name, phone_number").in("id", eligibleIds);
    if (landlordsError) return NextResponse.json({ error: landlordsError.message }, { status: 500 });

    const sms = AfricasTalking({
      apiKey: process.env.AFRICASTALKING_API_KEY as string,
      username: process.env.AFRICASTALKING_USERNAME as string,
    }).SMS;
    const senderId = process.env.AFRICASTALKING_SENDER_ID;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const landlord of (landlords || []) as any[]) {
      const phone = landlord.phone_number ? normalizePhone(landlord.phone_number) : null;
      if (!phone) {
        skipped++;
        continue;
      }
      try {
        const summary = await buildWeeklySummary(landlord.id);
        await sms.send({ to: [phone], message: formatSummarySms(summary), ...(senderId ? { from: senderId } : {}) });
        sent++;
      } catch (e: any) {
        errors.push((landlord.full_name || landlord.id) + ": " + (e.message || "failed"));
      }
    }

    return NextResponse.json({ success: true, sent, skipped, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Cron job failed" }, { status: 500 });
  }
}
