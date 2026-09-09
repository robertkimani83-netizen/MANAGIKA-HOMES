import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Prices are fixed here on the server — never trusted from the client.
// Must match PLAN_PRICES in subscription-stk-push / signup-stk-push.
const PLAN_PRICES: Record<string, number> = {
  starter: 1500,
  growth: 3000,
  portfolio: 6500,
};

const ANNUAL_DISCOUNT = 0.2;

const INTASEND_BASE =
  process.env.INTASEND_ENV === "live" ? "https://payment.intasend.com" : "https://sandbox.intasend.com";

// Card-payment twin of subscription-stk-push, for an existing logged-in
// landlord paying (or renewing) from /landlord/billing. Cards can't be
// charged directly the way M-Pesa's STK push works — the customer has to
// enter their card number on IntaSend's own hosted, PCI-compliant
// checkout page — so this creates that checkout session and hands back
// its url for the browser to redirect to. Unlike the homepage's
// signup-checkout, a landlord_id already exists here, so the webhook
// (subscription-callback) can credit the payment and activate the
// subscription on its own — no separate "finalize" step needed.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const landlordId = userData.user.id;

    const email = userData.user.email;
    if (!email) {
      return NextResponse.json({ error: "Your account has no email on file for card payments" }, { status: 400 });
    }

    const body = await request.json();
    const plan = body.plan;
    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json({ error: "Choose a valid plan (starter, growth, or portfolio)" }, { status: 400 });
    }

    const monthlyAmount = PLAN_PRICES[plan];
    const amount = billingCycle === "annual" ? Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT)) : monthlyAmount;

    const secretKey = process.env.INTASEND_SECRET_KEY;
    const publicKey = process.env.INTASEND_PUBLISHABLE_KEY;
    const callbackSecret = process.env.MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET;

    if (!secretKey || !publicKey || !callbackSecret) {
      return NextResponse.json({ error: "Subscription payments aren't switched on yet. Check back soon." }, { status: 503 });
    }

    const apiRef = "managika-card-" + plan + "-" + landlordId.slice(0, 8) + "-" + Date.now();

    const intasendRes = await fetch(INTASEND_BASE + "/api/v1/checkout/", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_key: publicKey,
        amount,
        currency: "KES",
        email,
        method: "CARD-PAYMENT",
        api_ref: apiRef,
        redirect_url: "https://managikahomes.co.ke/landlord/billing?checkout=1",
      }),
    });

    const intasendResult: any = await intasendRes.json().catch(() => ({}));
    const checkoutId = intasendResult?.id;
    const checkoutUrl = intasendResult?.url;

    if (!intasendRes.ok || !checkoutId || !checkoutUrl) {
      const rawMessage =
        intasendResult?.detail ||
        intasendResult?.message ||
        (Array.isArray(intasendResult?.errors) ? intasendResult.errors.join(", ") : null);
      const message = typeof rawMessage === "string" && rawMessage ? rawMessage : "Card payment could not be started.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    await supabaseAdmin.from("subscription_stk_requests").insert({
      checkout_request_id: checkoutId,
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

    return NextResponse.json({ id: checkoutId, url: checkoutUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to start card payment" }, { status: 500 });
  }
}
