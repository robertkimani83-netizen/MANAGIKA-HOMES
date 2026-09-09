import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

async function getLandlordId(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

const VALID_PLANS = ["starter", "growth", "portfolio"];

// Starts a landlord's free 7-day trial right after signup. This has to be
// a server route using supabaseAdmin (service role) rather than a plain
// client-side insert - landlord_subscriptions has no client-facing RLS
// write policy on purpose, because letting a logged-in landlord write
// their own row directly would let anyone set their own status to
// "active" for free. The homepage calls this once, immediately after
// supabase.auth.signUp() returns a session, so there's no gap where a
// newly created account has a landlord row but no subscription row (and
// therefore no dashboard access at all).
export async function POST(request: Request) {
  const landlordId = await getLandlordId(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const plan = VALID_PLANS.includes(body.plan) ? body.plan : "growth";
  const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";

  // A landlord only ever gets one trial. If a subscription row already
  // exists (an earlier trial, or a paid plan), leave it alone instead of
  // silently resetting it back to a fresh 7-day trial.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("landlord_subscriptions")
    .select("status")
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) {
    return NextResponse.json({ success: true, alreadyExisted: true, status: existing.status });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  const { error } = await supabaseAdmin.from("landlord_subscriptions").insert({
    landlord_id: landlordId,
    plan,
    billing_cycle: billingCycle,
    status: "trial",
    trial_ends_at: trialEndsAt.toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, trialEndsAt: trialEndsAt.toISOString() });
}
