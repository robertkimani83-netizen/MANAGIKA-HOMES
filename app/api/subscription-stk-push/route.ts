import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/tenant-phone";
import { extractIntasendError } from "@/lib/intasend-error";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Prices are fixed here on the server — never trusted from the client.
// Must match the numbers shown on /for-landlords.
const PLAN_PRICES: Record<string, number> = {
  starter: 1500,
  growth: 3000,
  portfolio: 6500,
};

// Annual billing gets 20% off, matching the "Pay annually and save 20%"
// copy on the /for-landlords pricing page.
const ANNUAL_DISCOUNT = 0.2;

// This is Managika's OWN revenue (landlords paying to use the platform) —
// separate from tenant rent collection, which still goes through each
// landlord's own Daraja credentials (see /api/mpesa-stk-push). This route
// used to call Safaricom's Daraja API directly with Robert's own Till.
// It now goes through IntaSend instead, since IntaSend already holds a
// verified Paybill and can turn on M-Pesa collections in a day or two,
// instead of waiting on Safaricom's own (repeatedly rejected) Till
// application. Flip INTASEND_ENV to "live" once the IntaSend account is
// verified for production; it defaults to their sandbox.
const INTASEND_BASE =
  process.env.INTASEND_ENV === "live" ? "https://payment.intasend.com" : "https://sandbox.intasend.com";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const landlordId = userData.user.id;

    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from("landlords")
      .select("id, phone_number")
      .eq("id", landlordId)
      .maybeSingle();
    if (landlordError || !landlord) {
      return NextResponse.json({ error: "Could not find your landlord account" }, { status: 400 });
    }

    const body = await request.json();
    const plan = body.plan;
    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";
    const rawPhone = (body.phoneNumber || landlord.phone_number || "").toString();

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json({ error: "Choose a valid plan (starter, growth, or portfolio)" }, { status: 400 });
    }

    const normalized = normalizePhone(rawPhone);
    if (!normalized) {
      return NextResponse.json({ error: "Enter a valid M-Pesa phone number" }, { status: 400 });
    }
    // IntaSend wants 2547XXXXXXXX — no leading "+".
    const phoneForIntasend = normalized.replace("+", "");

    const monthlyAmount = PLAN_PRICES[plan];
    const amount = billingCycle === "annual" ? Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT)) : monthlyAmount;

    const secretKey = process.env.INTASEND_SECRET_KEY;
    const publicKey = process.env.INTASEND_PUBLISHABLE_KEY;
    const callbackSecret = process.env.MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET;

    if (!secretKey || !publicKey || !callbackSecret) {
      return NextResponse.json({ error: "Subscription payments aren't switched on yet. Check back soon." }, { status: 503 });
    }

    // Unique per attempt, and tells us at a glance (from the IntaSend
    // dashboard) which landlord/plan a transaction belongs to.
    const apiRef = "managika-" + plan + "-" + landlordId.slice(0, 8) + "-" + Date.now();

    const intasendRes = await fetch(INTASEND_BASE + "/api/v1/payment/collection/", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_key: publicKey,
        currency: "KES",
        method: "M-PESA",
        amount,
        phone_number: phoneForIntasend,
        email: userData.user.email || undefined,
        api_ref: apiRef,
        narrative: "Managika Homes " + plan + " plan",
      }),
    });

    const intasendResult: any = await intasendRes.json().catch(() => ({}));
    const invoice = intasendResult?.invoice;

    if (!intasendRes.ok || !invoice?.invoice_id) {
      const message = extractIntasendError(intasendResult) || "M-Pesa did not accept this request.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    await supabaseAdmin.from("subscription_stk_requests").insert({
      // Reusing the existing checkout_request_id / merchant_request_id
      // columns (no migration needed) — checkout_request_id now holds
      // IntaSend's invoice_id, which is what the callback matches on.
      checkout_request_id: invoice.invoice_id,
      merchant_request_id: apiRef,
      landlord_id: landlordId,
      plan,
      billing_cycle: billingCycle,
      amount,
      status: "pending",
    });

    await supabaseAdmin.from("landlord_subscriptions").upsert(
      {
        landlord_id: landlordId,
        plan,
        billing_cycle: billingCycle,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "landlord_id" }
    );

    return NextResponse.json({ invoice_id: invoice.invoice_id, state: invoice.state });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to start payment" }, { status: 500 });
  }
}
