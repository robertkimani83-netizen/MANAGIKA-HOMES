import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhone, phoneVariants } from "@/lib/tenant-phone";

// A tenant sends a message from their own phone, by WhatsApp or SMS, and it
// lands on their landlord's Messages page. The tenant is recognised by the
// phone number the message came from (the landlord already saved it on the
// tenant), so nothing has to be typed but the message itself.
//
// A message that starts with the word COMPLAINT is also filed on the landlord's
// Complaints page (and in the tenant's own My Complaints):
//   "COMPLAINT The kitchen tap is leaking"  ->  complaint "The kitchen tap is leaking"
// Anything else is an ordinary message.

export type InboundSource = "whatsapp" | "sms";

export type InboundResult =
  | { status: "recorded"; tenantName: string; kind: "complaint" | "message"; firstThisHour: boolean }
  | { status: "duplicate" }
  | { status: "rate_limited"; tenantName: string }
  | { status: "ambiguous"; tenantName: string }
  | { status: "unknown_number" };

const KEYWORD = /^\s*(complaints?|complain|malalamiko|lalamiko)\b[\s:,.\-–]*/i;
const MAX_LENGTH = 1000;
const MAX_PER_HOUR = 10;

// Splits a message into "is it a complaint" and the text to keep.
export function parseMessage(text: string): { isComplaint: boolean; body: string } {
  const raw = String(text || "").trim();
  const match = raw.match(KEYWORD);
  if (match) {
    const body = raw.slice(match[0].length).trim().slice(0, MAX_LENGTH);
    if (body.length >= 3) return { isComplaint: true, body };
  }
  return { isComplaint: false, body: raw.slice(0, MAX_LENGTH) };
}

function firstName(fullName: string) {
  return (fullName || "").trim().split(/\s+/)[0] || "there";
}

// What to WhatsApp back, or null to stay silent. Unknown numbers and repeats
// get no reply, and a plain message is only answered the first time in an
// hour, so two phones can never get into a back-and-forth of automatic replies.
export function replyFor(result: InboundResult): string | null {
  switch (result.status) {
    case "recorded":
      if (result.kind === "complaint") {
        return "Thank you " + firstName(result.tenantName) + ". Your complaint has been sent to your landlord. You can follow it under My Complaints at managikahomes.co.ke/tenant/login";
      }
      return result.firstThisHour
        ? "Thank you " + firstName(result.tenantName) + ". Your message has been sent to your landlord. To report a problem, start your message with the word COMPLAINT."
        : null;
    case "rate_limited":
      return "Hello " + firstName(result.tenantName) + ", you have sent many messages in the last hour. Please wait a while and try again.";
    case "ambiguous":
      return "Hello " + firstName(result.tenantName) + ". We could not tell which house this number belongs to, so your message was not sent. Please sign in at managikahomes.co.ke/tenant/login.";
    default:
      return null;
  }
}

export async function recordInboundMessage(input: {
  phone: string;
  text: string;
  source: InboundSource;
  externalId: string;
  landlordId?: string; // when set, only this landlord's tenants are matched
}): Promise<InboundResult> {
  const e164 = normalizePhone(input.phone);
  if (!e164) return { status: "unknown_number" };

  let query = supabaseAdmin
    .from("tenants")
    .select("id, full_name, unit_id, landlord_id, status")
    .in("phone_number", phoneVariants(e164))
    .neq("status", "vacated");
  if (input.landlordId) query = query.eq("landlord_id", input.landlordId);
  const { data: tenants, error: tenantError } = await query;
  if (tenantError) throw new Error("tenant lookup failed: " + tenantError.message);

  if (!tenants || tenants.length === 0) return { status: "unknown_number" };
  // The same number on two tenants, or a tenant with no house or landlord,
  // cannot be filed with any certainty, so ask them to use the app instead.
  if (tenants.length > 1 || !tenants[0].unit_id || !tenants[0].landlord_id) {
    return { status: "ambiguous", tenantName: tenants[0].full_name };
  }
  const tenant = tenants[0];

  const parsed = parseMessage(input.text);
  if (!parsed.body) return { status: "duplicate" }; // nothing to keep (empty text)

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from("tenant_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .gte("created_at", since);
  if (countError) throw new Error("rate check failed: " + countError.message);
  const recent = count || 0;
  if (recent >= MAX_PER_HOUR) return { status: "rate_limited", tenantName: tenant.full_name };

  // Complaint first: if this message is delivered again after a failure half
  // way, the complaint already exists (23505) and we carry on to the message.
  if (parsed.isComplaint) {
    const { error: complaintError } = await supabaseAdmin.from("complaints").insert({
      tenant_id: tenant.id,
      unit_id: tenant.unit_id,
      description: parsed.body,
      status: "submitted",
      source: input.source,
      external_id: input.externalId,
    });
    if (complaintError && (complaintError as any).code !== "23505") {
      throw new Error("complaint insert failed: " + complaintError.message);
    }
  }

  const { error: messageError } = await supabaseAdmin.from("tenant_messages").insert({
    landlord_id: tenant.landlord_id,
    tenant_id: tenant.id,
    unit_id: tenant.unit_id,
    channel: input.source,
    kind: parsed.isComplaint ? "complaint" : "message",
    body: parsed.body,
    external_id: input.externalId,
  });
  if (messageError) {
    // 23505 = this exact message was already stored (the sender re-delivered it).
    if ((messageError as any).code === "23505") return { status: "duplicate" };
    throw new Error("message insert failed: " + messageError.message);
  }

  return { status: "recorded", tenantName: tenant.full_name, kind: parsed.isComplaint ? "complaint" : "message", firstThisHour: recent === 0 };
}
