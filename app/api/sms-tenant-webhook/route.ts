import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { secureCompare } from "@/lib/secure-compare";
import { recordInboundMessage } from "@/lib/inbound-message";

// Messages a tenant sends by plain SMS to the landlord's own phone. The Android
// SMS-forwarder app on that phone (the same one that forwards the Family Bank
// payment SMS) posts each incoming SMS here, with the same payload:
//   {"from":"%from%","text":"%text%","sentStamp":%sentStamp%}
// The request is signed exactly like the payment webhook (X-Signature =
// HMAC-SHA-256 of the body with SMS_WEBHOOK_SECRET), so only the configured
// phone can post here. Only an SMS from a number saved on one of this
// landlord's tenants is kept (on their Messages page; one starting with
// COMPLAINT is also filed as a complaint). Anything else - other people,
// M-Pesa and bank texts, one-time codes - is dropped without being stored.
//
// SMS_WEBHOOK_LANDLORD_ID (already set for the payment webhook) limits the
// match to that landlord's tenants.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const secret = process.env.SMS_WEBHOOK_SECRET || "";
    if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

    const supplied = (request.headers.get("x-signature") || "").trim().toLowerCase();
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
    const from = String(payload?.from || "");
    const text = String(payload?.text || "");
    if (!from || !text) return NextResponse.json({ status: "ignored" });

    // The same SMS delivered twice hashes to the same id and is stored once.
    const fingerprint = createHmac("sha256", secret).update(from + "|" + String(payload?.sentStamp ?? "") + "|" + text).digest("hex").slice(0, 32);
    const landlordId = (process.env.SMS_WEBHOOK_LANDLORD_ID || "").trim();

    const result = await recordInboundMessage({
      phone: from,
      text,
      source: "sms",
      externalId: "sms:" + fingerprint,
      ...(landlordId ? { landlordId } : {}),
    });

    return NextResponse.json({ status: result.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
