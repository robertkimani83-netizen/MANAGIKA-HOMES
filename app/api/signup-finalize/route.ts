import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

function addPeriod(billingCycle: string) {
  const d = new Date();
  if (billingCycle === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

// Claims a successfully-paid subscription_stk_requests row that was
// created (by signup-stk-push) before any landlord account existed, and
// finishes what subscription-callback couldn't: crediting the payment
// and activating the subscription, now that we finally have a
// landlord_id to attach it to. Called right after the visitor creates
// their account on the homepage's pay-first signup flow.
//
// One payment must buy exactly ONE subscription period, however many times
// this route is called with the same invoice_id (double-clicks, retries, or
// someone replaying the request on purpose to get free renewals). The
// landlord_id claim below is done as an atomic "only if still unclaimed"
// update, and the payment row has a UNIQUE receipt number, so a second call
// can never credit or extend anything.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const landlordId = userData.user.id;

    const body = await request.json().catch(() => ({}));
    const invoiceId = (body?.invoice_id || "").toString();
    if (!invoiceId) return NextResponse.json({ error: "Missing invoice_id" }, { status: 400 });

    const { data: stkRequest } = await supabaseAdmin
      .from("subscription_stk_requests")
      .select("id, plan, billing_cycle, amount, status, landlord_id, created_at")
      .eq("checkout_request_id", invoiceId)
      .maybeSingle();

    if (!stkRequest || stkRequest.status !== "success") {
      return NextResponse.json({ error: "Payment not found or not yet confirmed" }, { status: 400 });
    }

    // Already claimed by a different account — refuse.
    if (stkRequest.landlord_id && stkRequest.landlord_id !== landlordId) {
      return NextResponse.json({ error: "This payment is already linked to a different account" }, { status: 409 });
    }

    let claimedNow = false;

    if (stkRequest.landlord_id === landlordId) {
      // Already linked to THIS account. Either it was fully credited (by the
      // payment webhook, or by an earlier call to this route) - then this is
      // just a repeat and must change nothing - or a previous call linked it
      // but died before crediting, in which case we finish the job. A payment
      // recorded for this landlord since the request was created means it
      // was credited.
      const { data: credited } = await supabaseAdmin
        .from("subscription_payments")
        .select("id")
        .eq("landlord_id", landlordId)
        .gte("paid_at", stkRequest.created_at)
        .limit(1);
      if (credited && credited.length > 0) {
        return NextResponse.json({ ok: true, already_activated: true });
      }
    } else {
      // Unclaimed: claim it atomically. If two requests race, only one
      // update matches a row still having landlord_id null.
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from("subscription_stk_requests")
        .update({ landlord_id: landlordId })
        .eq("id", stkRequest.id)
        .is("landlord_id", null)
        .select("id");
      if (claimError) throw new Error(claimError.message);
      if (!claimed || claimed.length === 0) {
        // Lost the race to someone else (possibly a repeat of this same
        // request, which is now already being handled).
        return NextResponse.json({ ok: true, already_activated: true });
      }
      claimedNow = true;
    }

    // Same fallback subscription-callback uses: IntaSend's exact M-Pesa
    // receipt field isn't nailed down from docs alone, and by this point
    // the original webhook body is long gone — invoice_id is always
    // present and unique, so it's the dependable choice here.
    const mpesaReceiptNumber = invoiceId;

    // Undo the claim so the visitor can simply try again, instead of being
    // left paid-but-not-activated.
    async function release() {
      if (claimedNow) {
        await supabaseAdmin.from("subscription_stk_requests").update({ landlord_id: null }).eq("id", stkRequest!.id);
      }
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("subscription_payments")
      .insert({
        landlord_id: landlordId,
        plan: stkRequest.plan,
        billing_cycle: stkRequest.billing_cycle,
        amount: stkRequest.amount,
        mpesa_receipt_number: mpesaReceiptNumber,
      })
      .select("id")
      .single();

    if (paymentError) {
      if ((paymentError as any).code === "23505") {
        // This payment was already credited - nothing more to do.
        return NextResponse.json({ ok: true, already_activated: true });
      }
      await release();
      return NextResponse.json({ error: "Failed to finish activating your subscription" }, { status: 500 });
    }

    const { error: subError } = await supabaseAdmin.from("landlord_subscriptions").upsert(
      {
        landlord_id: landlordId,
        plan: stkRequest.plan,
        billing_cycle: stkRequest.billing_cycle,
        status: "active",
        current_period_end: addPeriod(stkRequest.billing_cycle),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "landlord_id" }
    );

    if (subError) {
      // Roll the payment record back too, so a retry starts clean.
      await supabaseAdmin.from("subscription_payments").delete().eq("id", payment.id);
      await release();
      return NextResponse.json({ error: "Failed to finish activating your subscription" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to finish activating your subscription" }, { status: 500 });
  }
}
