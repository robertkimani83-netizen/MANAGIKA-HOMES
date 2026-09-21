import { NextResponse } from "next/server";
import AfricasTalking from "africastalking";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";
import { sendRentReminderWhatsapp } from "@/lib/whatsapp";
import { buildReminderSms } from "@/lib/reminder-sms";
import { loadPaybillInfo } from "@/lib/paybill-server";
import { paybillAccount, type PaybillInfo } from "@/lib/paybill";
import { nairobiPeriod } from "@/lib/period";

function currentPeriod() {
  // Kenya-time month (servers run in UTC) - see lib/period.ts.
  return nairobiPeriod();
}

function toKenyanFormat(phone: string) {
const digits = phone.replace(/\D/g, "");
if (digits.startsWith("254")) return "+" + digits;
if (digits.startsWith("0")) return "+254" + digits.slice(1);
if (digits.startsWith("7") || digits.startsWith("1")) return "+254" + digits;
return "+" + digits;
}

export async function GET(request: Request) {
const authHeader = request.headers.get("authorization") || "";
const cronSecret = process.env.CRON_SECRET || "";
if (!cronSecret || !secureCompare(authHeader, "Bearer " + cronSecret)) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

try {
const period = currentPeriod();
const today = new Date();
const dueDate = new Date(today.getFullYear(), today.getMonth(), 5).toISOString().slice(0, 10);

const { data: tenants, error: tenantsError } = await supabaseAdmin
  .from("tenants")
  .select("id, landlord_id, full_name, phone_number, unit_id, units(id, unit_number, base_rent, status)")
  .eq("status", "active");

if (tenantsError) {
  return NextResponse.json({ error: tenantsError.message }, { status: 500 });
}

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY as string,
  username: process.env.AFRICASTALKING_USERNAME as string,
});
const sms = africastalking.SMS;
const senderId = process.env.AFRICASTALKING_SENDER_ID;

let remindersSent = 0;
let whatsappSent = 0;
let invoicesCreated = 0;
const errors: string[] = [];
// Each landlord's Paybill details, looked up once and reused for all of their tenants.
const paybillByLandlord = new Map<string, PaybillInfo | null>();

for (const tenant of (tenants || []) as any[]) {
  const unit = tenant.units;
  if (!unit || unit.status !== "occupied") continue;

  const rent = Number(unit.base_rent) || 0;
  if (rent <= 0) continue;

  let invoiceId: string | null = null;
  let totalDue = rent;

  const { data: existingInvoice, error: invoiceLookupError } = await supabaseAdmin
    .from("invoices")
    .select("id, total_due")
    .eq("tenant_id", tenant.id)
    .eq("billing_period", period)
    .maybeSingle();

  if (invoiceLookupError) {
    errors.push(tenant.full_name + ": " + invoiceLookupError.message);
    continue;
  }

  if (existingInvoice) {
    invoiceId = existingInvoice.id;
    totalDue = Number(existingInvoice.total_due);
  } else {
    const { data: newInvoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number: "INV-" + Date.now() + "-" + tenant.id.slice(0, 6),
        tenant_id: tenant.id,
        unit_id: unit.id,
        billing_period: period,
        rent_amount: rent,
        total_due: rent,
        status: "unpaid",
        due_date: dueDate,
      })
      .select("id")
      .single();

    if (invError || !newInvoice) {
      errors.push(tenant.full_name + ": " + (invError?.message || "invoice creation failed"));
      continue;
    }
    invoiceId = newInvoice.id;
    invoicesCreated++;
  }

  const { data: existingPayments } = await supabaseAdmin
    .from("payments")
    .select("amount_paid")
    .eq("invoice_id", invoiceId);

  const totalPaid = (existingPayments || []).reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  const balance = Math.max(totalDue - totalPaid, 0);

  if (balance <= 0) continue;
  if (!tenant.phone_number) {
    errors.push(tenant.full_name + ": no phone number on file");
    continue;
  }

  let paybill: PaybillInfo | null = null;
  if (tenant.landlord_id) {
    if (!paybillByLandlord.has(tenant.landlord_id)) paybillByLandlord.set(tenant.landlord_id, await loadPaybillInfo(tenant.landlord_id));
    paybill = paybillByLandlord.get(tenant.landlord_id) || null;
  }

  const message = buildReminderSms({ fullName: tenant.full_name, balance, unitNumber: unit.unit_number, period, paybill });

  try {
    await sms.send({ to: [toKenyanFormat(tenant.phone_number)], message: message, ...(senderId ? { from: senderId } : {}) });
    remindersSent++;
  } catch (smsError: any) {
    errors.push(tenant.full_name + ": SMS failed - " + (smsError.message || "unknown error"));
  }

  // WhatsApp is sent in addition to SMS, not instead of it - if the
  // template isn't approved yet or the send otherwise fails, that's logged
  // here but never blocks the SMS reminder above from having gone out.
  try {
    const waResult = await sendRentReminderWhatsapp(tenant.phone_number, {
      name: tenant.full_name,
      amount: balance.toLocaleString(),
      period,
      unit: unit.unit_number,
      paybill: paybill ? paybill.paybill : undefined,
      account: paybill ? paybillAccount(paybill, unit.unit_number) : undefined,
    });
    if (waResult.ok) {
      whatsappSent++;
    } else {
      errors.push(tenant.full_name + ": WhatsApp failed - " + waResult.error);
    }
  } catch (waError: any) {
    errors.push(tenant.full_name + ": WhatsApp failed - " + (waError.message || "unknown error"));
  }
}

return NextResponse.json({ success: true, period, invoicesCreated, remindersSent, whatsappSent, errors });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Cron job failed" }, { status: 500 });
}
}
