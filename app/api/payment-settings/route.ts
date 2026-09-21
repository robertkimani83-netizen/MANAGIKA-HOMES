import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanAccountPrefix, cleanPaybill } from "@/lib/paybill";
import { cleanDueDay, toReminderRules } from "@/lib/reminder-rules";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

async function getLandlordId(request: Request) {
const authHeader = request.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();
if (!token) return null;
const { data, error } = await supabaseAuth.auth.getUser(token);
if (error || !data.user) return null;
return data.user.id;
}

export async function GET(request: Request) {
const landlordId = await getLandlordId(request);
if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data, error } = await supabaseAdmin.from("landlord_payment_settings").select("*").eq("landlord_id", landlordId).maybeSingle();
if (error) return NextResponse.json({ error: error.message }, { status: 500 });

if (!data) {
  return NextResponse.json({
    mpesa_enabled: false,
    mpesa_shortcode: "",
    mpesa_shortcode_type: "paybill",
    mpesa_consumer_key_set: false,
    mpesa_consumer_secret_set: false,
    mpesa_passkey_set: false,
    manual_mpesa_enabled: false,
    manual_mpesa_type: "till",
    manual_mpesa_number: "",
    manual_mpesa_name: "",
    bank_enabled: false,
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch: "",
    paybill_number: "",
    paybill_account: "",
    reminder_due_day: 5,
    reminder_penalties: true,
  });
}

return NextResponse.json({
  mpesa_enabled: data.mpesa_enabled,
  mpesa_shortcode: data.mpesa_shortcode || "",
  mpesa_shortcode_type: data.mpesa_shortcode_type || "paybill",
  mpesa_consumer_key_set: !!data.mpesa_consumer_key,
  mpesa_consumer_secret_set: !!data.mpesa_consumer_secret,
  mpesa_passkey_set: !!data.mpesa_passkey,
  manual_mpesa_enabled: data.manual_mpesa_enabled,
  manual_mpesa_type: data.manual_mpesa_type || "till",
  manual_mpesa_number: data.manual_mpesa_number || "",
  manual_mpesa_name: data.manual_mpesa_name || "",
  bank_enabled: data.bank_enabled,
  bank_name: data.bank_name || "",
  bank_account_name: data.bank_account_name || "",
  bank_account_number: data.bank_account_number || "",
  bank_branch: data.bank_branch || "",
  paybill_number: data.paybill_number || "",
  paybill_account: data.paybill_account || "",
  reminder_due_day: toReminderRules(data).dueDay,
  reminder_penalties: toReminderRules(data).penalties,
});
}

export async function POST(request: Request) {
const landlordId = await getLandlordId(request);
if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const body = await request.json();

// Paybill shown to tenants in reminders: 5-7 digits, or left empty. Reject a
// bad number instead of quietly dropping it, so the landlord sees the mistake.
const paybillRaw = String(body.paybill_number ?? "").trim();
const paybillNumber = cleanPaybill(paybillRaw);
if (paybillRaw && !paybillNumber) {
  return NextResponse.json({ error: "The Paybill number should be 5 to 7 digits, like 222111." }, { status: 400 });
}

// Rent due day (1-28), or left empty for the 5th. Reject a bad value instead
// of quietly dropping it.
const dueDayRaw = String(body.reminder_due_day ?? "").trim();
const dueDay = cleanDueDay(dueDayRaw);
if (dueDayRaw && dueDay === null) {
  return NextResponse.json({ error: "The rent due day should be a number from 1 to 28, like 5." }, { status: 400 });
}

const update: any = {
  landlord_id: landlordId,
  mpesa_enabled: !!body.mpesa_enabled,
  mpesa_shortcode: body.mpesa_shortcode || null,
  mpesa_shortcode_type: body.mpesa_shortcode_type || "paybill",
  manual_mpesa_enabled: !!body.manual_mpesa_enabled,
  manual_mpesa_type: body.manual_mpesa_type || "till",
  manual_mpesa_number: body.manual_mpesa_number || null,
  manual_mpesa_name: body.manual_mpesa_name || null,
  bank_enabled: !!body.bank_enabled,
  bank_name: body.bank_name || null,
  bank_account_name: body.bank_account_name || null,
  bank_account_number: body.bank_account_number || null,
  bank_branch: body.bank_branch || null,
  paybill_number: paybillNumber || null,
  paybill_account: cleanAccountPrefix(body.paybill_account) || null,
  reminder_due_day: dueDay,
  updated_at: new Date().toISOString(),
};

// Only change the penalties setting when the page sent it.
if (typeof body.reminder_penalties === "boolean") update.reminder_penalties = body.reminder_penalties;

if (body.mpesa_consumer_key) update.mpesa_consumer_key = body.mpesa_consumer_key;
if (body.mpesa_consumer_secret) update.mpesa_consumer_secret = body.mpesa_consumer_secret;
if (body.mpesa_passkey) update.mpesa_passkey = body.mpesa_passkey;

const { error } = await supabaseAdmin.from("landlord_payment_settings").upsert(update, { onConflict: "landlord_id" });

if (error) return NextResponse.json({ error: error.message }, { status: 500 });

return NextResponse.json({ success: true });
}
