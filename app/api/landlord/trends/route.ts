import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Builds the last N "Month YYYY" period strings, oldest first, in the
// exact format currentPeriod() already uses everywhere else in the app
// (billing_period is stored as this string, not a date column).
function lastNPeriods(n: number) {
  const periods: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push({ key: MONTH_NAMES[d.getMonth()] + " " + d.getFullYear(), label: MONTH_NAMES[d.getMonth()].slice(0, 3) });
  }
  return periods;
}

// Collection-rate trend for the last 6 billing periods, computed from
// invoices/payments - both are permanent historical records, unlike
// units.status which only reflects "right now" (there's no vacancy-
// over-time table yet, so that's deliberately not attempted here - see
// the accompanying write-up).
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const landlordId = userData.user.id;

    const periods = lastNPeriods(6);
    const periodKeys = periods.map((p) => p.key);

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("billing_period, total_due, tenants!inner(landlord_id)")
      .eq("tenants.landlord_id", landlordId)
      .in("billing_period", periodKeys);

    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("amount_paid, invoices!inner(billing_period, tenants!inner(landlord_id))")
      .eq("invoices.tenants.landlord_id", landlordId)
      .in("invoices.billing_period", periodKeys);

    const dueByPeriod = new Map<string, number>();
    for (const inv of invoices || []) {
      const key = (inv as any).billing_period;
      dueByPeriod.set(key, (dueByPeriod.get(key) || 0) + (Number((inv as any).total_due) || 0));
    }

    const collectedByPeriod = new Map<string, number>();
    for (const p of payments || []) {
      const key = (p as any).invoices?.billing_period;
      if (!key) continue;
      collectedByPeriod.set(key, (collectedByPeriod.get(key) || 0) + (Number((p as any).amount_paid) || 0));
    }

    const trend = periods.map((p) => {
      const totalDue = dueByPeriod.get(p.key) || 0;
      const totalCollected = collectedByPeriod.get(p.key) || 0;
      const collectionRate = totalDue > 0 ? Math.min(100, Math.round((totalCollected / totalDue) * 100)) : null;
      return { period: p.key, label: p.label, totalDue, totalCollected, collectionRate };
    });

    return NextResponse.json({ trend });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load trends" }, { status: 500 });
  }
}
