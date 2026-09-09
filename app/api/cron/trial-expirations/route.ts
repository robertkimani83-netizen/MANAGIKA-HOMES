import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";
import { normalizePhone } from "@/lib/tenant-phone";
import { extractIntasendError } from "@/lib/intasend-error";

// Prices are fixed here on the server — never trusted from the client.
// Must match the numbers shown on /for-landlords and the other payment routes.
const PLAN_PRICES: Record<string, number> = {
  starter: 1500,
  growth: 3000,
  portfolio: 6500,
};

// Annual billing gets 20% off, matching the "Pay annually and save 20%"
// copy on the /for-landlords pricing page.
const ANNUAL_DISCOUNT = 0.2;

const INTASEND_BASE =
  process.env.INTASEND_ENV === "live" ? "https://payment.intasend.com" : "https://sandbox.intasend.com";

// Runs on a schedule (see vercel.json). A landlord who signed up for the
// free 7-day trial never had to enter payment details up front — this is
// what actually collects the first payment. Once a trial's trial_ends_at
// has passed, we send an M-Pesa STK push straight to the phone number on
// file, the same way /api/subscription-stk-push does when a landlord
// clicks "Pay with M-Pesa" themselves. If the push can't be sent (missing
// phone, IntaSend error, etc.) we deliberately leave status as "trial" —
// the dashboard already blocks access once trial_ends_at is in the past
// (see /landlord/dashboard), and this cron will just try again tomorrow.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const cronSecret = process.env.CRON_SECRET || "";
    if (!token || !cronSecret || !secureCompare(token, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secretKey = process.env.INTASEND_SECRET_KEY;
    const publicKey = process.env.INTASEND_PUBLISHABLE_KEY;
    if (!secretKey || !publicKey) {
      return NextResponse.json({ error: "IntaSend isn't configured yet" }, { status: 503 });
    }

    const nowIso = new Date().toISOString();

    const { data: expired, error: expiredError } = await supabaseAdmin
      .from("landlord_subscriptions")
      .select("landlord_id, plan, billing_cycle")
      .eq("status", "trial")
      .lt("trial_ends_at", nowIso);

    if (expiredError) {
      return NextResponse.json({ error: expiredError.message }, { status: 500 });
    }

    const results: Array<{ landlordId: string; ok: boolean; reason?: string }> = [];

    for (const sub of expired || []) {
      const plan = sub.plan && PLAN_PRICES[sub.plan] ? sub.plan : "starter";
      const billingCycle = sub.billing_cycle === "annual" ? "annual" : "monthly";

      const { data: landlord } = await supabaseAdmin
        .from("landlords")
        .select("id, email, phone_number")
        .eq("id", sub.landlord_id)
        .maybeSingle();

      const normalized = normalizePhone((landlord?.phone_number || "").toString());
      if (!landlord || !normalized) {
        results.push({ landlordId: sub.landlord_id, ok: false, reason: "no valid phone number on file" });
        continue;
      }
      const phoneForIntasend = normalized.replace("+", "");

      const monthlyAmount = PLAN_PRICES[plan];
      const amount = billingCycle === "annual" ? Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT)) : monthlyAmount;

      const apiRef = "managika-trial-" + plan + "-" + sub.landlord_id.slice(0, 8) + "-" + Date.now();

      try {
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
            email: landlord.email || undefined,
            api_ref: apiRef,
            narrative: "Managika Homes " + plan + " plan (trial ended)",
          }),
        });

        const intasendResult: any = await intasendRes.json().catch(() => ({}));
        const invoice = intasendResult?.invoice;

        if (!intasendRes.ok || !invoice?.invoice_id) {
          const message = extractIntasendError(intasendResult) || "IntaSend did not accept this request.";
          results.push({ landlordId: sub.landlord_id, ok: false, reason: message });
          continue;
        }

        await supabaseAdmin.from("subscription_stk_requests").insert({
          checkout_request_id: invoice.invoice_id,
          merchant_request_id: apiRef,
          landlord_id: sub.landlord_id,
          plan,
          billing_cycle: billingCycle,
          amount,
          status: "pending",
        });

        await supabaseAdmin
          .from("landlord_subscriptions")
          .update({ status: "pending", plan, billing_cycle: billingCycle, updated_at: new Date().toISOString() })
          .eq("landlord_id", sub.landlord_id)
          .eq("status", "trial");

        results.push({ landlordId: sub.landlord_id, ok: true });
      } catch (pushError: any) {
        results.push({ landlordId: sub.landlord_id, ok: false, reason: pushError?.message || "request failed" });
      }
    }

    return NextResponse.json({
      success: true,
      checked: (expired || []).length,
      pushed: results.filter((r) => r.ok).length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to run trial-expiration check" }, { status: 500 });
  }
}
