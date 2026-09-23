import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";
import { sendPaymentConfirmation, paymentBalanceText } from "@/lib/payment-confirmation";

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
//    SMS whose sender matches "FamilyBank" - everything else
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
// Sender rule in the app: "FamilyBank" (not a wildcard). This route compares
// the sender case-insensitively, so FamilyBank / FAMILYBANK both pass.
//
// SCOPING: set SMS_WEBHOOK_LANDLORD_ID (the landlord account that owns the
// units this paybill collects for) so a house tag is only ever matched
// against THAT landlord's units and tenants. If it is unset the route falls
// back to matching across all units (the original behaviour) and an
// ambiguous tag (same unit number under two landlords) is logged instead of
// guessed.

const LANDLORD_ID = (process.env.SMS_WEBHOOK_LANDLORD_ID || "").trim();

// "#D25", "d25", "D 25", "D25." all mean the same unit. Compared for exact
// equality in code (never through a database LIKE pattern), so characters
// such as % and _ in a tenant-typed tag can never act as wildcards.
function normalizeTag(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[.,;:]+$/, "");
}

// Month name for the invoice period, in Kenya time. The server runs in UTC,
// which would file a payment made between midnight and 3am (EAT) on the 1st
// under the previous month.
function nairobiPeriod() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Nairobi", year: "numeric", month: "long" }).formatToParts(new Date());
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  return month + " " + year;
}

export async function POST(request: Request) {
  // Flips to true the moment the payment row is safely stored. Before that, a
  // failure returns 500 so the forwarder retries (the duplicate check below
  // makes a retry harmless); after it, nothing left to retry.
  let paymentRecorded = false;
  let rawBodyForLog = "";
  try {
    // HMAC verified over the raw bytes, so read as text before JSON.parse -
    // parsing first and re-stringifying would not reproduce the exact
    // signed payload (key order/whitespace can differ) and would make
    // every signature check fail.
    const rawBody = await request.text();
    rawBodyForLog = rawBody;
    const suppliedSignature = (request.headers.get("x-signature") || "").trim().toLowerCase();
    const secret = process.env.SMS_WEBHOOK_SECRET || "";

    if (!secret) {
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!suppliedSignature || !secureCompare(suppliedSignature, expectedSignature)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Signed but not JSON - retrying the identical bytes can never help.
      await logUnmatched({ rawBody, sender: "", messageText: "", reason: "bad_payload" });
      return NextResponse.json({ status: "ignored_bad_payload" });
    }
    const from = String(payload?.from || "");
    const text = String(payload?.text || "");

    // Defense in depth - see note (2) above. The phone-side rule should
    // already guarantee this, so a mismatch here just means "ignore
    // quietly", not "log as a problem".
    if (!/FAMILYBANK/i.test(from)) {
      return NextResponse.json({ status: "ignored_sender" });
    }

    // The house tag is everything between "#" and "Mpesa Ref:" so units whose
    // number contains a space (e.g. "SHOP B1") can be paid as "#SHOP B1" or
    // "#SHOPB1"; for a normal tag like "#D25" the captured text is unchanged.
    // Matches: "Confirmed. You have received KES 1200.00 for Account 27833
    // from ELIUD OTIENO. #D25 Mpesa Ref:UIK5N73NAW on 20-09-2026 06:40Hrs"
    const match = text.match(
      /Confirmed\.\s+You have received KES\s+([\d,]+\.\d{2})\s+for Account\s+(\S+)\s+from\s+([A-Za-z\s]+?)\.\s*#(.{1,40}?)\s+Mpesa\s*Ref:(\S+)\s+on\s+(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})Hrs/i
    );

    if (!match) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "message_not_parseable" });
      return NextResponse.json({ status: "unmatched" });
    }

    const [, amountRaw, , payerName, houseTag, mpesaRef] = match;
    const amount = Number(amountRaw.replace(/,/g, ""));

    // House/unit tag is the only reliable per-tenant identifier here (the
    // bank Account number is fixed to mum's account on every message). Only
    // this landlord's units are considered when SMS_WEBHOOK_LANDLORD_ID is set.
    let unitQuery = supabaseAdmin
      .from("units")
      .select("id, unit_number, base_rent, properties!inner(landlord_id)");
    if (LANDLORD_ID) unitQuery = unitQuery.eq("properties.landlord_id", LANDLORD_ID);
    const { data: unitRows, error: unitError } = await unitQuery;
    if (unitError) throw new Error("unit lookup failed: " + unitError.message);

    const wanted = normalizeTag(houseTag);
    const unitMatches = (unitRows || []).filter((u: any) => normalizeTag(u.unit_number) === wanted);

    if (unitMatches.length === 0) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "no_matching_unit", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "unmatched" });
    }
    if (unitMatches.length > 1) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "ambiguous_unit", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "unmatched" });
    }
    const unit = unitMatches[0] as any;

    let tenantQuery = supabaseAdmin
      .from("tenants")
      .select("id, unit_id, full_name, phone_number, status")
      .eq("unit_id", unit.id);
    if (LANDLORD_ID) tenantQuery = tenantQuery.eq("landlord_id", LANDLORD_ID);
    const { data: tenantRows, error: tenantError } = await tenantQuery;
    if (tenantError) throw new Error("tenant lookup failed: " + tenantError.message);

    // Prefer the active tenant if a moved-out one is still on the unit.
    const activeTenants = (tenantRows || []).filter((t: any) => t.status === "active");
    const tenantCandidates = activeTenants.length > 0 ? activeTenants : tenantRows || [];

    if (tenantCandidates.length === 0) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "no_active_tenant_for_unit", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "unmatched" });
    }
    if (tenantCandidates.length > 1) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "multiple_tenants_for_unit", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "unmatched" });
    }
    const tenant = tenantCandidates[0] as any;

    // Dedup - guard against the forwarder app retrying (network hiccup,
    // phone reboot re-sending a stored failed message) recording the same
    // payment twice, same pattern as mpesa-callback.
    const { data: dup } = await supabaseAdmin.from("payments").select("id").eq("transaction_reference", mpesaRef).maybeSingle();
    if (dup) {
      return NextResponse.json({ status: "duplicate_ignored" });
    }

    const d = new Date();
    const period = nairobiPeriod();

    // The amount owed comes from the unit's own rent, never from what happened
    // to be paid: a KSh 1,200 payment against a 10,000 rent must show as
    // partially paid, not as a fully settled 1,200 invoice. Units with no rent
    // set keep the old behaviour so their payment is still recorded.
    const unitRent = Number(unit.base_rent) || 0;
    const invoiceTotal = unitRent > 0 ? unitRent : amount;

    let invoice: { id: string; total_due: number } | null = null;
    const findInvoice = async () => {
      const { data } = await supabaseAdmin
        .from("invoices")
        .select("id, total_due")
        .eq("tenant_id", tenant.id)
        .eq("billing_period", period)
        .maybeSingle();
      return (data as any) || null;
    };

    invoice = await findInvoice();
    if (!invoice) {
      const { data: newInvoice } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_number: "INV-" + Date.now(),
          tenant_id: tenant.id,
          unit_id: unit.id,
          billing_period: period,
          rent_amount: invoiceTotal,
          total_due: invoiceTotal,
          status: "unpaid",
          due_date: d.toISOString().slice(0, 10),
        })
        .select("id, total_due")
        .single();
      // If a concurrent request (or the monthly cron) created it first, use theirs.
      invoice = (newInvoice as any) || (await findInvoice());
    }

    if (!invoice) {
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "invoice_create_failed", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "error" });
    }

    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      invoice_id: invoice.id,
      amount_paid: amount,
      payment_method: "bank_transfer",
      transaction_reference: mpesaRef,
    });
    if (paymentError) {
      // 23505 = unique violation on transaction_reference: a concurrent
      // delivery of the same SMS won the race - already recorded, not an error.
      if ((paymentError as any).code === "23505") {
        return NextResponse.json({ status: "duplicate_ignored" });
      }
      throw new Error("could not store payment: " + paymentError.message);
    }
    paymentRecorded = true;

    const { data: allPayments } = await supabaseAdmin.from("payments").select("amount_paid").eq("invoice_id", invoice.id);
    const totalPaid = (allPayments || []).reduce((sum, p: any) => sum + (Number(p.amount_paid) || 0), 0);
    const newStatus = totalPaid >= Number(invoice.total_due) ? "paid" : "partially_paid";
    const { error: statusError } = await supabaseAdmin.from("invoices").update({ status: newStatus }).eq("id", invoice.id);
    if (statusError) {
      // The payment row is safe, but the invoice would keep showing "unpaid".
      // Surface it on the Unmatched SMS page rather than failing silently.
      await logUnmatched({ rawBody, sender: from, messageText: text, reason: "invoice_status_update_failed", amount, houseTag, payerName, mpesaRef });
      return NextResponse.json({ status: "recorded_with_warnings" });
    }

    // Same best-effort confirmation as mpesa-callback - on WhatsApp AND SMS,
    // fired together, neither one a fallback for the other. Never blocks or
    // fails the webhook response if either errors, the payment is already
    // recorded above regardless. Fires whether this payment fully settled
    // the invoice or left a balance still owed.
    if (tenant.phone_number) {
      try {
        const balanceText = paymentBalanceText(invoice.total_due, totalPaid);
        const { whatsapp, sms } = await sendPaymentConfirmation(tenant.phone_number, {
          fullName: tenant.full_name || "there",
          amount: amount.toLocaleString(),
          period,
          unitNumber: unit.unit_number,
          reference: mpesaRef,
          balanceText,
        });
        if (!whatsapp.ok || !sms.ok) {
          await logUnmatched({
            rawBody: rawBodyForLog,
            sender: from,
            messageText: text,
            reason: "confirmation_send_failed: whatsapp=" + (whatsapp.ok ? "ok" : whatsapp.error) + " sms=" + (sms.ok ? "ok" : sms.error),
            amount,
            houseTag,
            payerName,
            mpesaRef,
          });
        }
      } catch {
        // Best-effort only.
      }
    }

    return NextResponse.json({ status: "recorded" });
  } catch (error: any) {
    // Always leave a trace in sms_payment_log so a failure is visible on the
    // "Unmatched bank SMS" page instead of only in Vercel logs.
    await logUnmatched({
      rawBody: rawBodyForLog,
      sender: "",
      messageText: "",
      reason: "internal_error: " + String(error?.message || "unknown").slice(0, 200),
    });
    if (paymentRecorded) {
      // The payment is stored; only a later step (status update / WhatsApp)
      // failed. Retrying can't add anything, so tell the forwarder "done".
      return NextResponse.json({ status: "recorded_with_warnings" });
    }
    // Nothing was stored, so let the forwarder retry. The transaction
    // reference check above makes a repeat delivery safe (never double-books).
    return NextResponse.json({ status: "error" }, { status: 500 });
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
