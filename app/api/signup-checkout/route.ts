import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extractIntasendError } from "@/lib/intasend-error";

// Prices are fixed here on the server — never trusted from the client.
// Must match PLAN_PRICES in subscription-stk-push, signup-stk-push, and
// the numbers shown on the homepage.
const PLAN_PRICES: Record<string, number> = {
  starter: 1500,
  growth: 3000,
  portfolio: 6500,
};

const ANNUAL_DISCOUNT = 0.2;

const INTASEND_BASE =
  process.env.INTASEND_ENV === "live" ? "https://payment.intasend.com" : "https://sandbox.intasend.com";

// Public, unauthenticated card-payment twin of signup-stk-push, for the
// homepage's "pay first, then create your account" flow. Cards can't be
// charged directly from our backend the way M-Pesa's STK push works —
// the customer has to enter their card number on IntaSend's own hosted,
// PCI-compliant checkout page — so this creates that checkout session
// and hands back its url for the browser to redirect to. IntaSend
// redirects back to redirect_url once payment finishes; the homepage
// picks the payment back up from there (see the "resume a pending
// payment" effect in app/page.tsx), using the same
// subscription_stk_requests row / signup-stk-status / signup-finalize
// machinery already built for the M-Pesa side of this flow.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = body.plan;
    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";
    const email = (body.email || "").toString().trim();

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json({ error: "Choose a valid plan (starter, growth, or portfolio)" }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const monthlyAmount = PLAN_PRICES[plan];
    const amount = billingCycle === "annual" ? Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT)) : monthlyAmount;

    const secretKey = process.env.INTASEND_SECRET_KEY;
    const publicKey = process.env.INTASEND_PUBLISHABLE_KEY;
    const callbackSecret = process.env.MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET;

    if (!secretKey || !publicKey || !callbackSecret) {
      return NextResponse.json({ error: "Subscription payments aren't switched on yet. Check back soon." }, { status: 503 });
    }

    const apiRef = "managika-signup-card-" + plan + "-" + Date.now();

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
        redirect_url: "https://managikahomes.co.ke/",
      }),
    });

    const intasendResult: any = await intasendRes.json().catch(() => ({}));
    const checkoutId = intasendResult?.id;
    const checkoutUrl = intasendResult?.url;

    if (!intasendRes.ok || !checkoutId || !checkoutUrl) {
      // Diagnostic only — no card data or secrets in this body, just
      // whatever validation error IntaSend sent back. Helps confirm the
      // exact shape the first time a new kind of error shows up.
      console.log("[signup-checkout] IntaSend error response:", intasendRes.status, JSON.stringify(intasendResult));
      const message = extractIntasendError(intasendResult) || "Card payment could not be started.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    await supabaseAdmin.from("subscription_stk_requests").insert({
      checkout_request_id: checkoutId,
      merchant_request_id: apiRef,
      landlord_id: null,
      plan,
      billing_cycle: billingCycle,
      amount,
      status: "pending",
    });

    return NextResponse.json({ id: checkoutId, url: checkoutUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to start card payment" }, { status: 500 });
  }
}
