// Thin wrapper around the WhatsApp Cloud API for sending pre-approved
// template messages (rent_reminder, payment_confirmation). Business-initiated
// WhatsApp messages can ONLY be sent as an approved template - free-form text
// only works within 24h of the customer messaging us first - so every call
// here must name a template that has been approved in Meta's WhatsApp
// Manager. Until a template's status is "Approved" this will return an
// error from Meta (rejected) rather than silently failing, which the caller
// should catch and log without blocking the rest of the flow (an SMS, an
// invoice update) it's attached to.

import { normalizePhone } from "@/lib/tenant-phone";

const GRAPH_VERSION = "v21.0";

export type WhatsappSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

// Converts any of the phone formats already accepted elsewhere in the app
// (07XXXXXXXX, 254XXXXXXXXX, +254XXXXXXXXX, 7XXXXXXXX) into the digits-only
// E.164 form the Cloud API's `to` field expects (254XXXXXXXXX, no "+").
function toWhatsappRecipient(phone: string): string | null {
  const e164 = normalizePhone(phone);
  if (!e164) return null;
  return e164.replace(/\D/g, "");
}

// Sends one template message. `params` are the {{1}}, {{2}}, ... body
// variables in order, as plain strings (numbers/dates should already be
// formatted the way the template's sample text was, e.g. "10,000").
export async function sendWhatsappTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  params: string[]
): Promise<WhatsappSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp is not configured (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)" };
  }

  const recipient = toWhatsappRecipient(to);
  if (!recipient) {
    return { ok: false, error: "Invalid phone number: " + to };
  }

  const body = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text: String(text) })),
        },
      ],
    },
  };

  try {
    const response = await fetch(
      "https://graph.facebook.com/" + GRAPH_VERSION + "/" + phoneNumberId + "/messages",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error?.message || "WhatsApp API request failed (" + response.status + ")";
      return { ok: false, error: message };
    }

    const messageId = data?.messages?.[0]?.id || null;
    return { ok: true, messageId };
  } catch (err: any) {
    return { ok: false, error: err?.message || "WhatsApp request failed" };
  }
}
