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
      .select("id, plan, billing_cycle, amount, status, landlord_id")
      .eq("checkout_request_id", invoiceId)
      .maybeSingle();

    if (!stkRequest || stkRequest.status !== "success") {
      return NextResponse.json({ error: "Payment not found or not yet confirmed" }, { status: 400 });
    }

    // Already claimed by a different account — refuse. If it was already
    // claimed by THIS account (e.g. a retried request), fall through and
    // treat it as a success rather than erroring.
    if (stkRequest.landlord_id && stkRequest.landlord_id !== landlordId) {
      return NextResponse.json({ error: "This payment is already linked to a different account" }, { status: 409 });
    }

    if (!stkRequest.landlord_id) {
      await supabaseAdmin.from("subscription_stk_requests").update({ landlord_id: landlordId }).eq("id", stkRequest.id);
    }

    // Same fallback subscription-callback uses: IntaSend's exact M-Pesa
    // receipt field isn't nailed down from docs alone, and by this point
    // the original webhook body is long gone — invoice_id is always
    // present and unique, so it's the dependable choice here.
    const mpesaReceiptNumber = invoiceId;

    const { data: dup } = await supabaseAdmin
      .from("subscription_payments")
      .select("id")
      .eq("mpesa_receipt_number", mpesaReceiptNumber)
      .maybeSingle();

    if (!dup) {
      await supabaseAdmin.from("subscription_payments").insert({
        landlord_id: landlordId,
        plan: stkRequest.plan,
        billing_cycle: stkRequest.billing_cycle,
        amount: stkRequest.amount,
        mpesa_receipt_number: mpesaReceiptNumber,
      });
    }

    await supabaseAdmin.from("landlord_subscriptions").upsert(
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

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to finish activating your subscription" }, { status: 500 });
  }
}
