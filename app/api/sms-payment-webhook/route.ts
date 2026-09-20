import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";
import { sendWhatsappTemplate } from "@/lib/whatsapp";

// Auto-confirms rent payments detected from Family Bank SMS forwarded off
// mum's phone (paybill 222111, her personal Account 27833 - shared across
// every tenant, so the ONLY thing that tells us which tenant paid is the
// house/unit tag ("#D25") each tenant is instructed to append when sending
// money). This mirrors app/api/mpesa-callback/route.ts (auto-record + fire
// the same WhatsApp payment_confirmation template) - see that route for the
// invoice/payment/status logic this one is built to match.
//
// SECURITY MODEL (per Robert's explicit choice - fully automatic, no
// landlord tap-to-confirm step):
// 1. The Android forwarder app on mum's phone is configured to ONLY forward
//    SMS whose sender exactly matches "FAMILYBANK" - everything else
//    (a tenant's personal text saying "i have paid room #20", spam, wrong
//    numbers) never reaches this endpoint at all.
// 2. This route re-checks the sender server-side too (defense in depth, in
//    case that phone-side filter is ever loosened by mistake).
// 3. The request must carry a valid HMAC-SHA-256 signature (header
//    X-Signature, hex-encoded) computed over the raw request body using
//    SMS_WEBHOOK_SECRET - the same secret entered into the forwarder app's
//    "Sign with HMAC-SHA-256" option. This proves the request really came
//    from mum's configured phone, not just anyone who finds this URL.
// 4. A message that doesn't parse, or whose house tag doesn't match a real
//    unit/tenant, is logged to sms_payment_log (see the matching migration)
//    instead of being silently dropped or blocking anything - a safety net
//    to glance at occasionally, not an approval queue.
//
// FORWARDER APP PAYLOAD TEMPLATE (set this exact JSON in the app's
// "Webhook URL" config, payload field):
//   {"from":"%from%","text":"%text%","sentStamp":%sentStamp%}
// Sender rule in the app: exact match "FAMILYBANK" (not a wildcard).

export async function POST(request: Request) {
  try {
    // HMAC verified over the raw bytes, so read as text before JSON.parse -
    // parsing first and re-stringifying would not reproduce the exact
    // signed payload (key order/whitespace can differ) and would make
    // every signature check fail.
    const rawBody = await request.text();
    const suppliedSignature = (request.headers.get("x-signature") || "").trim().toLowerCase();
    const secret = process.env.SMS_WEBHOOK_SECRET || "";

    if (!secret) {
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!suppliedSignature || !secureCompare(suppliedSignature, expectedSignature)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const from = String(payload?.from || "");
    const text = String(payload?.text || "");

    // Defense in depth - see note (2) above. The phone-side rule should
    // already guarantee this, so a mismatch here just means "ignore
    // quietly", not "log as a problem".
    if (!/FAMILYBANK/i.test(from)) {
      return NextResponse.json({ status: "ignored_sender" });
    }

    // Matches: "Confirmed. You have received KES 1200.00 for Account 27833
    // from ELIUD OTIENO. #D25 Mpesa Ref:UIK5N73NAW on 20-09-2026 06:40Hrs"
    const match = text.match(
      /Confirmed\.\s+You have received KES\s+([\d,]+\.\d{2})\s+for Account\s+(\S+)\s+from\s+([A-Za-z\s]+?)\.\s*#(\S+)\s+Mpesa\s*Ref:(\S+)\s+on\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})Hrs/i
    );

    if (!match) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "message_not_parseable" });
      return NextResponse.json({ status: "unmatched" });
    }

    const [, amountRaw, , payerName, houseTag, mpesaRef] = match;
    const amount = Number(amountRaw.replace(/,/g, ""));

    // House/unit tag is the only reliable per-tenant identifier here (the
    // bank Account number is fixed to mum's account on every message) -
    // exact match, case-insensitive so "#d25" and "#D25" both resolve.
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("id, unit_number")
      .ilike("unit_number", houseTag)
      .maybeSingle();

    if (!unit) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "no_matching_unit", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "unmatched" });
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, unit_id, full_name, phone_number")
      .eq("unit_id", unit.id)
      .maybeSingle();

    if (!tenant) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "no_active_tenant_for_unit", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "unmatched" });
    }

    // Dedup - guard against the forwarder app retrying (network hiccup,
    // phone reboot re-sending a stored failed message) recording the same
    // payment twice, same pattern as mpesa-callback.
    const { data: dup } = await supabaseAdmin.from("payments").select("id").eq("transaction_reference", mpesaRef).maybeSingle();
    if (dup) {
      return NextResponse.json({ status: "duplicate_ignored" });
    }

    const d = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const period = monthNames[d.getMonth()] + " " + d.getFullYear();

    let invoice: { id: string; total_due: number } | null = null;
    const { data: existingInvoice } = await supabaseAdmin
      .from("invoices")
      .select("id, total_due")
      .eq("tenant_id", tenant.id)
      .eq("billing_period", period)
      .maybeSingle();

    if (existingInvoice) {
      invoice = existingInvoice as any;
    } else {
      const { data: newInvoice } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_number: "INV-" + Date.now(),
          tenant_id: tenant.id,
          unit_id: unit.id,
          billing_period: period,
          rent_amount: amount,
          total_due: amount,
          status: "unpaid",
          due_date: d.toISOString().slice(0, 10),
        })
        .select("id, total_due")
        .single();
      invoice = newInvoice as any;
    }

    if (!invoice) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "invoice_create_failed", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "error" });
    }

    await supabaseAdmin.from("payments").insert({
      invoice_id: invoice.id,
      amount_paid: amount,
      payment_method: "bank_transfer",
      transaction_reference: mpesaRef,
    });

    const { data: allPayments } = await supabaseAdmin.from("payments").select("amount_paid").eq("invoice_id", invoice.id);
    const totalPaid = (allPayments || []).reduce((sum, p: any) => sum + (Number(p.amount_paid) || 0), 0);
    const newStatus = totalPaid >= Number(invoice.total_due) ? "paid" : "partially_paid";
    await supabaseAdmin.from("invoices").update({ status: newStatus }).eq("id", invoice.id);

    // Same best-effort WhatsApp confirmation as mpesa-callback - never
    // blocks or fails the webhook response if it errors, the payment is
    // already recorded above regardless.
    if (newStatus === "paid" && tenant.phone_number) {
      try {
        await sendWhatsappTemplate(tenant.phone_number, "payment_confirmation", "en", [
          tenant.full_name || "there",
          amount.toLocaleString(),
          period,
          unit.unit_number,
          mpesaRef,
        ]);
      } catch {
        // Best-effort only.
      }
    }

    return NextResponse.json({ status: "recorded" });
  } catch (error: any) {
    // Swallow so the forwarder app doesn't get stuck retrying forever on a
    // transient error - the message is lost in that rare case rather than
    // hammering the endpoint, matching mpesa-callback's own posture.
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

async function logUnmatched(entry: {
  rawBody: string;
  sender: string;
  messageText: string;
  reason: string;
  amount?: number;
  houseTag?: string;
  payerName?: string;
  mpesaRef?: string;
}) {
  try {
    await supabaseAdmin.from("sms_payment_log").insert({
      raw_message: entry.rawBody,
      sender: entry.sender,
      message_text: entry.messageText,
      reason: entry.reason,
      amount: entry.amount ?? null,
      house_tag: entry.houseTag ?? null,
      payer_name: entry.payerName ?? null,
      mpesa_ref: entry.mpesaRef ?? null,
    });
  } catch {
    // Logging is a safety net, not critical path - never let a logging
    // failure surface as an error to the forwarder app.
  }
}
