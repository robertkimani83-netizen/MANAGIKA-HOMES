import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL as string,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export async function POST(request: Request) {
try {
const body = await request.json();
const callback = body?.Body?.stkCallback;

if (!callback) {
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

const resultCode = callback.ResultCode;
const items = callback.CallbackMetadata?.Item || [];

function getValue(name: string) {
  const found = items.find((i: any) => i.Name === name);
  return found ? found.Value : null;
}

if (resultCode === 0) {
  const amount = getValue("Amount");
  const phoneNumber = getValue("PhoneNumber");
  const mpesaReceiptNumber = getValue("MpesaReceiptNumber");

  const phoneStr = String(phoneNumber);
  const localFormat = phoneStr.startsWith("254") ? "0" + phoneStr.slice(3) : phoneStr;

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, unit_id")
    .or("phone_number.eq." + phoneStr + ",phone_number.eq." + localFormat)
    .maybeSingle();

  if (tenant) {
    const d = new Date();
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const period = names[d.getMonth()] + " " + d.getFullYear();

    let { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("id, total_due")
      .eq("tenant_id", tenant.id)
      .eq("billing_period", period)
      .maybeSingle();

    if (!invoice) {
      const { data: newInvoice } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_number: "INV-" + Date.now(),
          tenant_id: tenant.id,
          unit_id: tenant.unit_id,
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
      await supabaseAdmin.from("payments").insert({
        invoice_id: invoice.id,
        amount_paid: amount,
        payment_method: "mpesa",
        transaction_reference: mpesaReceiptNumber,
      });

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