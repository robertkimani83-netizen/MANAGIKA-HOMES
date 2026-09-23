// Texts Robert (ADMIN_ALERT_PHONE) the moment something in the money-handling
// pipeline breaks - a payment that couldn't be saved, an M-Pesa/SMS webhook
// that crashed, or a bank SMS with real money in it that couldn't be matched
// to a tenant. Vercel's own logs already capture the detail; this is the
// "somebody actually notices today, not whenever the logs get checked" layer.
//
// Throttled to at most one alert per `key` every 30 minutes, using the same
// rate_limit_hit() counter (via allowRequest) the rest of the app already
// uses for request throttling - so a repeating failure (a bad deploy, an
// expired token) doesn't burn through SMS credit texting the same problem
// over and over. Each distinct `key` gets its own 30-minute window.
//
// Never throws - alerting is a safety net, not critical path. If it can't
// send (not configured, Africa's Talking down, whatever), the failure is
// only logged, never allowed to break the caller.

import AfricasTalking from "africastalking";
import { normalizePhone } from "@/lib/tenant-phone";
import { allowRequest } from "@/lib/rate-limit";

const ALERT_WINDOW_SECONDS = 30 * 60;
const SMS_MAX = 160;

export async function sendAdminAlert(key: string, message: string): Promise<void> {
  try {
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const username = process.env.AFRICASTALKING_USERNAME;
    const adminPhoneRaw = process.env.ADMIN_ALERT_PHONE;

    if (!apiKey || !username || !adminPhoneRaw) {
      console.error("[admin-alert] not configured (missing AFRICASTALKING_API_KEY/USERNAME or ADMIN_ALERT_PHONE) - alert dropped:", key, "-", message);
      return;
    }

    const to = normalizePhone(adminPhoneRaw);
    if (!to) {
      console.error("[admin-alert] ADMIN_ALERT_PHONE is not a recognisable phone number:", adminPhoneRaw);
      return;
    }

    // Already alerted for this key recently - don't spam the same problem.
    const allowed = await allowRequest("admin-alert:" + key, 1, ALERT_WINDOW_SECONDS);
    if (!allowed) return;

    const africastalking = AfricasTalking({ apiKey, username });
    const senderId = process.env.AFRICASTALKING_SENDER_ID;
    const text = ("Managika alert: " + message).slice(0, SMS_MAX);
    const result = await africastalking.SMS.send({ to: [to], message: text, ...(senderId ? { from: senderId } : {}) });
    const recipient = result?.SMSMessageData?.Recipients?.[0];
    if (recipient?.status !== "Success") {
      console.error("[admin-alert] SMS send did not report success:", recipient?.status, "-", key);
    }
  } catch (err: any) {
    console.error("[admin-alert] failed to send:", err?.message || err, "-", key);
  }
}
