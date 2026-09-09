import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/tenant-phone";

// Prices are fixed here on the server — never trusted from the client.
// Must match PLAN_PRICES in subscription-stk-push and the numbers shown
// on the homepage.
const PLAN_PRICES: Record<string, number> = {
  starter: 1500,
  growth: 3000,
  portfolio: 6500,
};

// Annual billing gets 20% off, matching subscription-stk-push.
const ANNUAL_DISCOUNT = 0.2;

const INTASEND_BASE =
  process.env.INTASEND_ENV === "live" ? "https://payment.intasend.com" : "https://sandbox.intasend.com";

// Public, unauthenticated twin of subscription-stk-push — used by the
// homepage's "pay first, then create your account" flow. No landlord
// account exists yet at this point, so the resulting
// subscription_stk_requests row is created with landlord_id left null.
// Once IntaSend confirms the payment (subscription-callback) and the
// visitor finishes creating their account, /api/signup-finalize claims
// this row by matching invoice_id and links it to the new landlord.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = body.plan;
    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";
    const rawPhone = (body.phoneNumber || "").toString();

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

    // Unique per attempt. No landlord id exists yet, so this is prefixed
    // "signup" (vs. subscription-stk-push's "managika-<plan>-<landlordId>")
    // to tell the two flows apart at a glance in the IntaSend dashboard.
    const apiRef = "managika-signup-" + plan + "-" + Date.now();

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
        api_ref: apiRef,
        narrative: "Managika Homes " + plan + " plan",
      }),
    });

    const intasendResult: any = await intasendRes.json().catch(() => ({}));
    const invoice = intasendResult?.invoice;

    if (!intasendRes.ok || !invoice?.invoice_id) {
      const message =
        intasendResult?.detail ||
        intasendResult?.message ||
        (Array.isArray(intasendResult?.errors) ? intasendResult.errors.join(", ") : null) ||
        "M-Pesa did not accept this request.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    await supabaseAdmin.from("subscription_stk_requests").insert({
      checkout_request_id: invoice.invoice_id,
      merchant_request_id: apiRef,
      landlord_id: null,
      phone_number: normalized,
      plan,
      billing_cycle: billingCycle,
      amount,
      status: "pending",
    });

    return NextResponse.json({ invoice_id: invoice.invoice_id, state: invoice.state });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to start payment" }, { status: 500 });
  }
}
