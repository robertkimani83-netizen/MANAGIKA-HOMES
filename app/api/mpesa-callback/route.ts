import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";

export async function POST(request: Request) {
try {
// Reject any call that doesn't carry our own secret token in the URL.
// Safaricom calls this exact URL (with the token baked in) - a real payment
// confirmation can only ever arrive with the correct token attached. Anyone
// else guessing at this endpoint (without the token) is rejected here,
// before touching any tenant/invoice/payment data.
const { searchParams } = new URL(request.url);
const suppliedToken = searchParams.get("token") || "";
const expectedToken = process.env.MPESA_CALLBACK_SECRET || "";
if (!expectedToken || !secureCompare(suppliedToken, expectedToken)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const body = await request.json();
const callback = body?.Body?.stkCallback;

if (!callback) {
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

const resultCode = callback.ResultCode;
const checkoutRequestId = callback.CheckoutRequestID;
const items = callback.CallbackMetadata?.Item || [];

function getValue(name: string) {
  const found = items.find((i: any) => i.Name === name);
  return found ? found.Value : null;
}

const { data: tracked } = await supabaseAdmin
  .from("stk_push_requests")
  .select("id, tenant_id, invoice_id, amount")
  .eq("checkout_request_id", checkoutRequestId)
  .maybeSingle();

if (tracked) {
  await supabaseAdmin.from("stk_push_requests").update({ status: resultCode === 0 ? "completed" : "failed" }).eq("id", tracked.id);
}

if (resultCode === 0) {
  const amount = getValue("Amount") || tracked?.amount;
  const mpesaReceiptNumber = getValue("MpesaReceiptNumber");
  const phoneNumber = getValue("PhoneNumber");

  let tenantId = tracked?.tenant_id || null;
  let unitId: string | null = null;

  if (tenantId) {
    const { data: tenantRow } = await supabaseAdmin.from("tenants").select("unit_id").eq("id", tenantId).maybeSingle();
    unitId = tenantRow?.unit_id || null;
  } else {
    // Strip to digits only before building the .or() filter string below -
    // that string is handed straight to PostgREST's filter grammar (commas
    // and parentheses are syntax there), so a PhoneNumber value that isn't
    // pure digits could otherwise inject extra filter clauses and match a
    // different tenant's record than intended.
    const phoneStr = String(phoneNumber).replace(/\D/g, "");
    const localFormat = phoneStr.startsWith("254") ? "0" + phoneStr.slice(3) : phoneStr;
    const { data: tenantRow } = await supabaseAdmin.from("tenants").select("id, unit_id").or("phone_number.eq." + phoneStr + ",phone_number.eq." + localFormat).maybeSingle();
    tenantId = tenantRow?.id || null;
    unitId = tenantRow?.unit_id || null;
  }

  if (tenantId) {
    const d = new Date();
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const period = names[d.getMonth()] + " " + d.getFullYear();

    let invoice: any = null;

    if (tracked?.invoice_id) {
      const { data } = await supabaseAdmin.from("invoices").select("id, total_due").eq("id", tracked.invoice_id).maybeSingle();
      invoice = data;
    }

    if (!invoice) {
      const { data: existing } = await supabaseAdmin.from("invoices").select("id, total_due").eq("tenant_id", tenantId).eq("billing_period", period).maybeSingle();
      invoice = existing;
    }

    if (!invoice) {
      const { data: newInvoice } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_number: "INV-" + Date.now(),
          tenant_id: tenantId,
          unit_id: unitId,
          billing_period: period,
          rent_amount: amount,
          total_due: amount,
          status: "unpaid",
          due_date: d.toISOString().slice(0, 10),
        })
        .select("id, total_due")
        .single();
      invoice = newInvoice;
    }

    if (invoice) {
      // Guard against the same M-Pesa receipt being recorded twice if Safaricom retries the callback.
      const { data: dup } = await supabaseAdmin.from("payments").select("id").eq("transaction_reference", mpesaReceiptNumber).maybeSingle();
      if (!dup) {
        await supabaseAdmin.from("payments").insert({
          invoice_id: invoice.id,
          amount_paid: amount,
          payment_method: "mpesa",
          transaction_reference: mpesaReceiptNumber,
        });
      }

      const { data: allPayments } = await supabaseAdmin
        .from("payments")
        .select("amount_paid")
        .eq("invoice_id", invoice.id);

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      const newStatus = totalPaid >= Number(invoice.total_due) ? "paid" : "partially_paid";

      await supabaseAdmin.from("invoices").update({ status: newStatus }).eq("id", invoice.id);
    }
  }
}

return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

} catch (error: any) {
return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
}
