import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { secureCompare } from "@/lib/secure-compare";
import { recordInboundMessage, replyFor } from "@/lib/inbound-message";
import { sendWhatsappText } from "@/lib/whatsapp";

// Receives what tenants WhatsApp to our business number. Every message from a
// number saved on a tenant goes to that tenant's landlord (Messages page); one
// that starts with COMPLAINT is also filed as a complaint. The tenant gets a
// short thank-you. Set up once in Meta (WhatsApp > Configuration > Webhook):
//   Callback URL   https://managikahomes.co.ke/api/whatsapp-webhook
//   Verify token   the value of WHATSAPP_VERIFY_TOKEN
//   Subscribe to   messages
// WHATSAPP_APP_SECRET (the Meta app's secret) is used to check that a request
// really came from Meta, so nobody else can post fake messages here.

export const dynamic = "force-dynamic";

// Meta calls this once when the webhook is saved, to check we own it.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const token = url.searchParams.get("hub.verify_token") || "";
  if (expected && url.searchParams.get("hub.mode") === "subscribe" && secureCompare(token, expected)) {
    return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    // The signature is over the exact bytes Meta sent, so read the raw text.
    const rawBody = await request.text();
    const secret = process.env.WHATSAPP_APP_SECRET || "";
    if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

    const supplied = (request.headers.get("x-hub-signature-256") || "").replace(/^sha256=/i, "").trim().toLowerCase();
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!supplied || !secureCompare(supplied, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: "ignored_bad_payload" });
    }

    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        for (const message of change?.value?.messages || []) {
          // Only typed text; delivery receipts and pictures are ignored.
          if (message?.type !== "text" || !message?.from || !message?.id) continue;

          const result = await recordInboundMessage({
            phone: String(message.from),
            text: String(message?.text?.body || ""),
            source: "whatsapp",
            externalId: "wa:" + message.id,
          });

          const reply = replyFor(result);
          if (reply) {
            // The message is already saved; a failed thank-you must not undo
            // it or make Meta send the same message again.
            await sendWhatsappText(String(message.from), reply).catch(() => null);
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    // A real failure (database down): 500 makes Meta try again, and the
    // message id stops the retry from saving it twice.
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
