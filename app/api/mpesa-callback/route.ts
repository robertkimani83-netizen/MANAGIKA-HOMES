import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";
import { sendPaymentConfirmation, paymentBalanceText } from "@/lib/payment-confirmation";
import { nairobiPeriod, nairobiDate } from "@/lib/period";
import { sendAdminAlert } from "@/lib/admin-alert";

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
  let tenantFullName: string | null = null;
  let tenantPhoneNumber: string | null = null;

  if (tenantId) {
    const { data: tenantRow } = await supabaseAdmin.from("tenants").select("unit_id, full_name, phone_number").eq("id", tenantId).maybeSingle();
    unitId = tenantRow?.unit_id || null;
    tenantFullName = tenantRow?.full_name || null;
    tenantPhoneNumber = tenantRow?.phone_number || null;
  } else {
    // Strip to digits only before building the .or() filter string below -
    // that string is handed straight to PostgREST's filter grammar (commas
    // and parentheses are syntax there), so a PhoneNumber value that isn't
    // pure digits could otherwise inject extra filter clauses and match a
    // different tenant's record than intended.
    const phoneStr = String(phoneNumber).replace(/\D/g, "");
    const localFormat = phoneStr.startsWith("254") ? "0" + phoneStr.slice(3) : phoneStr;
    const { data: tenantRow } = await supabaseAdmin.from("tenants").select("id, unit_id, full_name, phone_number").or("phone_number.eq." + phoneStr + ",phone_number.eq." + localFormat).maybeSingle();
    tenantId = tenantRow?.id || null;
    unitId = tenantRow?.unit_id || null;
    tenantFullName = tenantRow?.full_name || null;
    tenantPhoneNumber = tenantRow?.phone_number || null;
  }

  if (tenantId) {
    // Kenya-time month: servers run in UTC, so plain getMonth() would put a
    // payment made in the first 3 hours of the month on last month's invoice.
    const period = nairobiPeriod();

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
      // The invoice must be for the unit's real rent - not for whatever
      // happened to be paid - otherwise a part payment would create an
      // invoice for just that amount and show as fully paid.
      let unitRent = 0;
      if (unitId) {
        const { data: unitRow } = await supabaseAdmin.from("units").select("base_rent").eq("id", unitId).maybeSingle();
        unitRent = Number(unitRow?.base_rent) || 0;
      }
      const invoiceTotal = unitRent > 0 ? unitRent : Number(amount);

      const { data: newInvoice, error: newInvoiceError } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_number: "INV-" + Date.now(),
          tenant_id: tenantId,
          unit_id: unitId,
          billing_period: period,
          rent_amount: invoiceTotal,
          total_due: invoiceTotal,
          status: "unpaid",
          due_date: nairobiDate(),
        })
        .select("id, total_due")
        .single();
      if (newInvoiceError) console.error("[mpesa-callback] could not create invoice:", newInvoiceError.message, "receipt", mpesaReceiptNumber);
      invoice = newInvoice;
    }

    if (invoice) {
      // Guard against the same M-Pesa receipt being recorded twice if Safaricom retries the callback.
      const { data: dup } = await supabaseAdmin.from("payments").select("id").eq("transaction_reference", mpesaReceiptNumber).maybeSingle();
      if (!dup) {
        const { error: paymentInsertError } = await supabaseAdmin.from("payments").insert({
          invoice_id: invoice.id,
          amount_paid: amount,
          payment_method: "mpesa",
          transaction_reference: mpesaReceiptNumber,
        });
        // A real payment that fails to save must never disappear silently -
        // this line in the Vercel logs is how it gets found and fixed by hand.
        if (paymentInsertError && (paymentInsertError as any).code !== "23505") {
          console.error("[mpesa-callback] PAYMENT NOT SAVED:", paymentInsertError.message, "receipt", mpesaReceiptNumber, "amount", amount, "tenant", tenantId);
          await sendAdminAlert("payment-not-saved", "M-Pesa payment of KSh " + amount + " (receipt " + mpesaReceiptNumber + ") did NOT save. Check Vercel logs.");
        }
      }

      const { data: allPayments } = await supabaseAdmin
        .from("payments")
        .select("amount_paid")
        .eq("invoice_id", invoice.id);

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      const newStatus = totalPaid >= Number(invoice.total_due) ? "paid" : "partially_paid";

      const { error: statusUpdateError } = await supabaseAdmin.from("invoices").update({ status: newStatus }).eq("id", invoice.id);
      if (statusUpdateError) console.error("[mpesa-callback] could not update invoice status:", statusUpdateError.message, "invoice", invoice.id);

      // Let the tenant know their payment was received - on WhatsApp AND SMS,
      // fired together (neither is a fallback for the other), whether it
      // fully settled the invoice or left a balance still owed. This never
      // blocks or fails the M-Pesa callback response itself: Safaricom needs
      // a 200 back regardless, so any error on either channel is swallowed
      // here.
      if (tenantPhoneNumber) {
        try {
          let unitNumber = "";
          if (unitId) {
            const { data: unitRow } = await supabaseAdmin.from("units").select("unit_number").eq("id", unitId).maybeSingle();
            unitNumber = unitRow?.unit_number || "";
          }
          const balanceText = paymentBalanceText(invoice.total_due, totalPaid);
          const { whatsapp, sms } = await sendPaymentConfirmation(tenantPhoneNumber, {
            fullName: tenantFullName || "there",
            amount: Number(amount).toLocaleString(),
            period,
            unitNumber,
            reference: mpesaReceiptNumber || "",
            balanceText,
          });
          if (!whatsapp.ok) console.error("[mpesa-callback] WhatsApp confirmation failed:", whatsapp.error, "tenant", tenantId);
          if (!sms.ok) console.error("[mpesa-callback] SMS confirmation failed:", sms.error, "tenant", tenantId);
          if (!whatsapp.ok && !sms.ok) {
            await sendAdminAlert("payment-confirmation-failed", "A tenant paid but got NO confirmation (WhatsApp and SMS both failed). Tenant: " + (tenantFullName || tenantId));
          }
        } catch {
          // Best-effort only - the payment itself is already recorded above.
        }
      }
    }
  }
}

return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

} catch (error: any) {
// Safaricom still needs a 200 back, but never swallow the reason silently:
// without this line a failed payment record leaves no trace at all.
console.error("[mpesa-callback] error while processing callback:", error?.message || error);
await sendAdminAlert("mpesa-callback-crash", "M-Pesa callback crashed: " + String(error?.message || error).slice(0, 100));
return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
}
