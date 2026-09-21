import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import AfricasTalking from "africastalking";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendRentReminderWhatsapp } from "@/lib/whatsapp";
import { buildReminderSms } from "@/lib/reminder-sms";
import { loadReminderSettings } from "@/lib/paybill-server";
import { paybillAccount, paybillLine } from "@/lib/paybill";
import { nairobiPeriod } from "@/lib/period";

function currentPeriod() {
  // Kenya-time month (servers run in UTC) - see lib/period.ts.
  return nairobiPeriod();
}

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

function toKenyanFormat(phone: string) {
const digits = (phone || "").replace(/\D/g, "");
if (digits.startsWith("254")) return "+" + digits;
if (digits.startsWith("0")) return "+254" + digits.slice(1);
if (digits.startsWith("7") || digits.startsWith("1")) return "+254" + digits;
return "+" + digits;
}

export async function POST(request: Request) {
try {
// Only a logged-in landlord may send a reminder, and only to one of their own tenants.
// The phone number always comes from our own tenant record - never from the request body -
// so this can never be used as a free SMS relay to an arbitrary number.
const authHeader = request.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const body = await request.json();
const { tenantId, message } = body;
if (!tenantId || !message) {
  return NextResponse.json({ error: "Missing tenantId or message" }, { status: 400 });
}

const { data: tenant, error: tenantError } = await supabaseAdmin
  .from("tenants")
  .select("id, landlord_id, full_name, phone_number, units(unit_number)")
  .eq("id", tenantId)
  .maybeSingle();
if (tenantError || !tenant || tenant.landlord_id !== userData.user.id) {
  return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
}
if (!tenant.phone_number) {
  return NextResponse.json({ error: "This tenant has no phone number on file." }, { status: 400 });
}

// What the tenant owes across all unpaid invoices, and their unit - used for
// both the SMS wording and the WhatsApp template below.
let balance = 0;
let balanceKnown = true;
try {
  const { data: unpaidInvoices } = await supabaseAdmin
    .from("invoices")
    .select("id, total_due")
    .eq("tenant_id", tenantId)
    .in("status", ["unpaid", "partially_paid"]);
  for (const inv of unpaidInvoices || []) {
    const { data: pays } = await supabaseAdmin.from("payments").select("amount_paid").eq("invoice_id", inv.id);
    const paid = (pays || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    balance += Math.max(Number(inv.total_due) - paid, 0);
  }
} catch {
  balanceKnown = false;
}

const unitRaw: any = (tenant as any).units;
const unitNumber: string = (Array.isArray(unitRaw) ? unitRaw[0]?.unit_number : unitRaw?.unit_number) || "";

// The landlord's Paybill (if they set one) goes into the reminder so the
// tenant is told exactly where to pay, e.g. "Paybill 222111, Account 27833#A14".
const { paybill, rules } = await loadReminderSettings(tenant.landlord_id);

// SMS text: built here (not taken from the browser) so it is one readable SMS
// with the payment instructions. If we cannot work out an unpaid balance or the
// tenant has no unit, the landlord's own wording is sent, with the Paybill line
// added when there is a unit to build the account from.
let smsMessage: string;
if (balanceKnown && balance > 0 && unitNumber) {
  smsMessage = buildReminderSms({ fullName: tenant.full_name || "", balance, unitNumber, paybill, dueDay: rules.dueDay, penalties: rules.penalties });
} else {
  smsMessage = paybill && unitNumber ? message + " " + paybillLine(paybill, unitNumber) : message;
}

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY as string,
  username: process.env.AFRICASTALKING_USERNAME as string,
});

const sms = africastalking.SMS;

const senderId = process.env.AFRICASTALKING_SENDER_ID;
const result = await sms.send({
  to: [toKenyanFormat(tenant.phone_number)],
  message: smsMessage,
  ...(senderId ? { from: senderId } : {}),
});

// Africa's Talking always returns HTTP 200 with success:true from our own
// fetch, even when it did NOT actually deliver the message - the real
// answer is buried in result.SMSMessageData.Recipients[0].status. Check
// that explicitly instead of trusting the outer response, so the landlord
// is never told "Reminder sent" for a message that was actually rejected.
const recipient = result?.SMSMessageData?.Recipients?.[0];
const delivered = recipient?.status === "Success";

// WhatsApp is sent in addition to SMS, not instead of it, and is attempted
// regardless of whether the SMS above succeeded - matching the nightly cron
// job's behaviour. A failure on either channel is reported back to the
// landlord (so "Sent" claims are honest) but never blocks the other channel.
let whatsapp: { ok: boolean; error?: string } = { ok: false, error: "not attempted" };
try {
  if (balance <= 0) {
    // The WhatsApp template is a fixed "your rent balance of KSh X is due"
    // message, so it must not go out for a tenant who owes nothing.
    whatsapp = { ok: false, error: balanceKnown ? "no unpaid balance, so no WhatsApp rent reminder was sent" : "could not work out the balance, so no WhatsApp rent reminder was sent" };
  } else {
    const waResult = await sendRentReminderWhatsapp(tenant.phone_number, {
      name: tenant.full_name || "there",
      amount: balance.toLocaleString(),
      period: currentPeriod(),
      unit: unitNumber || "-",
      paybill: paybill && unitNumber ? paybill.paybill : undefined,
      account: paybill && unitNumber ? paybillAccount(paybill, unitNumber) : undefined,
      penalties: rules.penalties,
      dueDay: rules.dueDay,
    });
    whatsapp = waResult.ok ? { ok: true } : { ok: false, error: waResult.error };
  }
} catch (waError: any) {
  whatsapp = { ok: false, error: waError?.message || "WhatsApp request failed" };
}

if (!delivered) {
  const reason = recipient?.status || "Unknown error";
  return NextResponse.json(
    {
      success: false,
      error:
        "SMS was not delivered (reason: " +
        reason +
        "). The recipient's number may be blocked or opted out of promotional SMS." +
        (whatsapp.ok ? " WhatsApp reminder was sent successfully." : " WhatsApp also failed: " + whatsapp.error),
      result,
      whatsapp,
    },
    { status: 502 }
  );
}

return NextResponse.json({ success: true, result, whatsapp });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to send SMS" }, { status: 500 });
}
}
