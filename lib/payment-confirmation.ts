// Sends the "we got your payment" message on WhatsApp and SMS TOGETHER, at
// the same time - not one as a fallback for the other. Robert wants both to
// fire on every trigger, so a tenant is never left without confirmation just
// because the WhatsApp template happens to be "in review" or rejected with
// Meta at the moment (as rent_reminder_paybill/rent_reminder_no_date/
// payment_confirmation all were on 2026-09-23), and vice versa if Africa's
// Talking has an issue.
//
// Used by every place a payment gets recorded: app/api/mpesa-callback,
// app/api/sms-payment-webhook, and app/api/send-payment-whatsapp (the
// manual-entry path called from app/payments/page.tsx).

import AfricasTalking from "africastalking";
import { sendWhatsappTemplate, type WhatsappSendResult } from "@/lib/whatsapp";
import { normalizePhone } from "@/lib/tenant-phone";

export type PaymentConfirmationInput = {
  fullName: string;
  amount: string; // already formatted, e.g. "10,000"
  period: string; // e.g. "September 2026"
  unitNumber: string;
  reference: string; // M-Pesa receipt / bank ref / manual reference
  balanceText: string; // "Your rent is now fully paid." or "Balance remaining: KSh X."
};

export type ChannelResult = { ok: boolean; error?: string };
export type PaymentConfirmationResult = { whatsapp: ChannelResult; sms: ChannelResult };

// The balance line shared by every payment-confirmation trigger: fully paid,
// or exactly how much is still owed on this invoice.
export function paymentBalanceText(totalDue: number, totalPaid: number): string {
  const remaining = Number(totalDue) - Number(totalPaid);
  return remaining <= 0
    ? "Your rent is now fully paid."
    : "Balance remaining: KSh " + remaining.toLocaleString() + ".";
}

const SMS_MAX = 160;

function buildConfirmationSms(input: PaymentConfirmationInput): string {
  const first = (input.fullName || "there").trim().split(/\s+/)[0] || "there";
  const name = first.length > 14 ? first.slice(0, 14) : first;
  const withReceipt =
    "Hi " + name + ", we've received your payment of KSh " + input.amount + " for " + input.period +
    " (Unit " + input.unitNumber + "). Receipt: " + input.reference + ". " + input.balanceText;
  if (withReceipt.length <= SMS_MAX) return withReceipt;

  // The receipt number is the least essential part for an SMS (it's always
  // on the WhatsApp message and the app) - drop it first before truncating
  // anything the tenant actually needs (amount, period, unit, balance).
  const noReceipt =
    "Hi " + name + ", we've received your payment of KSh " + input.amount + " for " + input.period +
    " (Unit " + input.unitNumber + "). " + input.balanceText;
  return noReceipt.length <= SMS_MAX ? noReceipt : noReceipt.slice(0, SMS_MAX);
}

async function sendConfirmationSms(phone: string, input: PaymentConfirmationInput): Promise<ChannelResult> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  if (!apiKey || !username) {
    return { ok: false, error: "SMS is not configured (missing AFRICASTALKING_API_KEY or AFRICASTALKING_USERNAME)" };
  }

  const to = normalizePhone(phone);
  if (!to) return { ok: false, error: "Invalid phone number: " + phone };

  try {
    const africastalking = AfricasTalking({ apiKey, username });
    const sms = africastalking.SMS;
    const senderId = process.env.AFRICASTALKING_SENDER_ID;
    const message = buildConfirmationSms(input);

    const result = await sms.send({ to: [to], message, ...(senderId ? { from: senderId } : {}) });

    // Africa's Talking returns HTTP 200 with success:true even when the
    // message was NOT actually delivered - the real answer is buried in
    // result.SMSMessageData.Recipients[0].status (same gotcha as
    // app/api/send-reminder/route.ts).
    const recipient = result?.SMSMessageData?.Recipients?.[0];
    const delivered = recipient?.status === "Success";
    return delivered ? { ok: true } : { ok: false, error: recipient?.status || "Unknown error" };
  } catch (err: any) {
    return { ok: false, error: err?.message || "SMS request failed" };
  }
}

async function sendConfirmationWhatsapp(phone: string, input: PaymentConfirmationInput): Promise<ChannelResult> {
  try {
    const result: WhatsappSendResult = await sendWhatsappTemplate(phone, "payment_confirmation", "en", [
      input.fullName || "there",
      input.amount,
      input.period,
      input.unitNumber,
      input.reference,
      input.balanceText,
    ]);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (err: any) {
    return { ok: false, error: err?.message || "WhatsApp request failed" };
  }
}

// Fires both channels at once (Promise.all, not sequential) and reports each
// one's own success/failure - neither channel waits on or is skipped because
// of the other.
export async function sendPaymentConfirmation(
  phone: string,
  input: PaymentConfirmationInput
): Promise<PaymentConfirmationResult> {
  const [whatsapp, sms] = await Promise.all([
    sendConfirmationWhatsapp(phone, input),
    sendConfirmationSms(phone, input),
  ]);
  return { whatsapp, sms };
}
