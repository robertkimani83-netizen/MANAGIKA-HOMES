import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import AfricasTalking from "africastalking";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

const { data: tenant, error: tenantError } = await supabaseAdmin.from("tenants").select("id, landlord_id, phone_number").eq("id", tenantId).maybeSingle();
if (tenantError || !tenant || tenant.landlord_id !== userData.user.id) {
  return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
}
if (!tenant.phone_number) {
  return NextResponse.json({ error: "This tenant has no phone number on file." }, { status: 400 });
}

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY as string,
  username: process.env.AFRICASTALKING_USERNAME as string,
});

const sms = africastalking.SMS;

const senderId = process.env.AFRICASTALKING_SENDER_ID;
const result = await sms.send({
  to: [toKenyanFormat(tenant.phone_number)],
  message: message,
  ...(senderId ? { from: senderId } : {}),
});

return NextResponse.json({ success: true, result });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to send SMS" }, { status: 500 });
}
}
