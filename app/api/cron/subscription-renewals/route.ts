import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";

// Runs on a schedule (see vercel.json). Finds landlord subscriptions that
// say "active" but whose paid period has actually run out, and flips them
// to "past_due". That's what makes the dashboard cleanly redirect a lapsed
// landlord to /landlord/billing with a clear message, instead of their
// pages silently going blank once the database access rules kick in.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const cronSecret = process.env.CRON_SECRET || "";
    if (!token || !cronSecret || !secureCompare(token, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nowIso = new Date().toISOString();

    const { data: lapsed, error: lapsedError } = await supabaseAdmin
      .from("landlord_subscriptions")
      .select("landlord_id")
      .eq("status", "active")
      .lt("current_period_end", nowIso);

    if (lapsedError) {
      return NextResponse.json({ error: lapsedError.message }, { status: 500 });
    }

    const lapsedIds = (lapsed || []).map((s) => s.landlord_id);

    if (lapsedIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("landlord_subscriptions")
        .update({ status: "past_due", updated_at: nowIso })
        .in("landlord_id", lapsedIds)
        .eq("status", "active");

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      checked: (lapsed || []).length,
      markedPastDue: lapsedIds.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to run renewal check" }, { status: 500 });
  }
}
