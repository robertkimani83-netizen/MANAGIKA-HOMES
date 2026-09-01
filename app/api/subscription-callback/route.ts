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

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const suppliedToken = searchParams.get("token") || "";
    const expectedToken = process.env.MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET || "";
    if (!expectedToken || !secureCompare(suppliedToken, expectedToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Ignored" });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    const { data: stkRequest } = await supabaseAdmin
      .from("subscription_stk_requests")
      .select("id, landlord_id, plan, billing_cycle, amount, status")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (!stkRequest) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Unknown request, ignored" });
    }

    if (resultCode !== 0) {
      await supabaseAdmin.from("subscription_stk_requests").update({ status: "failed" }).eq("id", stkRequest.id);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Recorded failure" });
    }

    const items: any[] = callback.CallbackMetadata?.Item || [];
    const getItem = (name: string) => items.find((i) => i.Name === name)?.Value;
    const mpesaReceiptNumber = getItem("MpesaReceiptNumber");

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

      await supabaseAdmin
        .from("landlord_subscriptions")
        .upsert(
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

    await supabaseAdmin.from("subscription_stk_requests").update({ status: "success" }).eq("id", stkRequest.id);

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (error: any) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Error handled" });
  }
}
