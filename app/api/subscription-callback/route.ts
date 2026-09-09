import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";

function addPeriod(billingCycle: string) {
  const d = new Date();
  if (billingCycle === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

// IntaSend calls this URL whenever a collection's state changes
// (PENDING -> PROCESSING -> COMPLETE, or FAILED). Configure the webhook
// in the IntaSend dashboard under Settings > Webhooks, using this route's
// full URL, and set the webhook's "challenge" value to the exact same
// string as MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET — IntaSend echoes that
// challenge back in every webhook body, which is how we know a request
// genuinely came from IntaSend (no signature header is provided). As a
// second, optional layer, the webhook URL itself can also carry
// ?token=<the same secret> — same pattern the old Daraja callback used.
export async function POST(request: Request) {
  try {
    const expectedToken = process.env.MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET || "";
    if (!expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const suppliedToken = searchParams.get("token") || "";

    const body: any = await request.json().catch(() => ({}));
    const suppliedChallenge = (body?.challenge || "").toString();

    const tokenOk = !!suppliedToken && secureCompare(suppliedToken, expectedToken);
    const challengeOk = !!suppliedChallenge && secureCompare(suppliedChallenge, expectedToken);
    if (!tokenOk && !challengeOk) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Diagnostic only — helps confirm the exact field names IntaSend sends
    // for a real collection the first time this runs against a live
    // payment. Safe to leave in; contains no card numbers or secrets.
    console.log("[subscription-callback] IntaSend webhook:", JSON.stringify(body));

    // The Collection API (M-Pesa STK push) confirms it documents
    // "invoice_id"; the Checkout API (used for card payments) hands back
    // its session as plain "id" when it's first created, and its webhook
    // field naming for that same id isn't confirmed from docs alone —
    // accept either so a card payment isn't silently dropped here.
    const invoiceId = body?.invoice_id || body?.id;
    const state = body?.state;
    if (!invoiceId || !state) {
      return NextResponse.json({ received: true });
    }

    const { data: stkRequest } = await supabaseAdmin
      .from("subscription_stk_requests")
      .select("id, landlord_id, plan, billing_cycle, amount, status")
      .eq("checkout_request_id", invoiceId)
      .maybeSingle();

    if (!stkRequest) {
      return NextResponse.json({ received: true, note: "Unknown invoice, ignored" });
    }

    if (state === "FAILED") {
      await supabaseAdmin.from("subscription_stk_requests").update({ status: "failed" }).eq("id", stkRequest.id);
      return NextResponse.json({ received: true });
    }

    if (state !== "COMPLETE") {
      // PENDING / PROCESSING — nothing to record yet, IntaSend will call
      // again once the customer finishes (or the payment fails/times out).
      return NextResponse.json({ received: true });
    }

    // Idempotency: IntaSend may retry the same webhook. If we already
    // marked this invoice successful, there's nothing left to do.
    if (stkRequest.status === "success") {
      return NextResponse.json({ received: true, note: "Already processed" });
    }

    // The exact field IntaSend uses for the underlying M-Pesa receipt
    // number isn't nailed down from docs alone — fall back to the
    // invoice_id (always present and unique) if none of these show up.
    const mpesaReceiptNumber = body?.mpesa_reference || body?.mpesa_receipt_number || body?.provider_reference || invoiceId;

    // The homepage's "pay first, then create your account" flow
    // (signup-stk-push) creates this row before any landlord account
    // exists, so landlord_id can be null here. In that case there's no
    // one to credit yet — just mark the request successful and stop;
    // /api/signup-finalize will create the subscription_payments and
    // landlord_subscriptions rows once the visitor finishes creating
    // their account and claims this invoice.
    if (stkRequest.landlord_id) {
      const { data: dup } = await supabaseAdmin
        .from("subscription_payments")
        .select("id")
        .eq("mpesa_receipt_number", mpesaReceiptNumber)
        .maybeSingle();

      if (!dup) {
        await supabaseAdmin.from("subscription_payments").insert({
          landlord_id: stkRequest.landlord_id,
          plan: stkRequest.plan,
          billing_cycle: stkRequest.billing_cycle,
          amount: stkRequest.amount,
          mpesa_receipt_number: mpesaReceiptNumber,
        });

        await supabaseAdmin.from("landlord_subscriptions").upsert(
          {
            landlord_id: stkRequest.landlord_id,
            plan: stkRequest.plan,
            billing_cycle: stkRequest.billing_cycle,
            status: "active",
            current_period_end: addPeriod(stkRequest.billing_cycle),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "landlord_id" }
        );
      }
    }

    await supabaseAdmin.from("subscription_stk_requests").update({ status: "success" }).eq("id", stkRequest.id);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    // Always 200 back to IntaSend so it doesn't sit there retrying a
    // request that already partially succeeded; errors are visible in
    // the Vercel function logs via the console.log above.
    return NextResponse.json({ received: true, error: "handled" });
  }
}
