import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

function currentPeriod() {
const d = new Date();
const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
return names[d.getMonth()] + " " + d.getFullYear();
}

function toSafaricomFormat(phone: string) {
const digits = (phone || "").replace(/\D/g, "");
if (digits.startsWith("254")) return digits;
if (digits.startsWith("0")) return "254" + digits.slice(1);
if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
return digits;
}

async function getAccessToken(consumerKey: string, consumerSecret: string) {
const auth = Buffer.from(consumerKey + ":" + consumerSecret).toString("base64");
const res = await fetch("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
  method: "GET",
  headers: { Authorization: "Basic " + auth },
});
const data = await res.json();
return data.access_token;
}

function timestampNow() {
const d = new Date();
const pad = (n: number) => n.toString().padStart(2, "0");
return d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

export async function POST(request: Request) {
try {
// 1. Verify the caller is a real logged-in tenant - never trust a client-supplied tenant id.
const authHeader = request.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
if (userError || !userData.user || !userData.user.email) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const { data: tenant, error: tenantError } = await supabaseAdmin
  .from("tenants")
  .select("id, full_name, phone_number, landlord_id, unit_id, units(base_rent)")
  .eq("email", userData.user.email)
  .maybeSingle();

if (tenantError || !tenant || !tenant.landlord_id) {
  return NextResponse.json({ error: "Could not find your tenant record" }, { status: 400 });
}
if (!tenant.phone_number) {
  return NextResponse.json({ error: "No phone number on file - contact your landlord." }, { status: 400 });
}

// 2. Find (or create) the current invoice and compute the real outstanding balance server-side.
// The amount charged is NEVER taken from the request body - it always comes from our own records.
const body = await request.json().catch(() => ({}));
const period = currentPeriod();
const unit: any = (tenant as any).units;
const baseRent = Number(unit?.base_rent) || 0;

let invoice: any = null;
if (body.invoiceId) {
  const { data } = await supabaseAdmin.from("invoices").select("id, total_due, tenant_id").eq("id", body.invoiceId).maybeSingle();
  if (data && data.tenant_id === tenant.id) invoice = data;
}
if (!invoice) {
  const { data } = await supabaseAdmin.from("invoices").select("id, total_due, tenant_id").eq("tenant_id", tenant.id).eq("billing_period", period).maybeSingle();
  invoice = data;
}
if (!invoice) {
  return NextResponse.json({ error: "No invoice found to pay." }, { status: 400 });
}

const { data: existingPayments } = await supabaseAdmin.from("payments").select("amount_paid").eq("invoice_id", invoice.id);
const totalPaid = (existingPayments || []).reduce((sum: number, p: any) => sum + (Number(p.amount_paid) || 0), 0);
const balance = Math.max(Number(invoice.total_due) - totalPaid, 0);

if (balance <= 0) {
  return NextResponse.json({ error: "This invoice is already fully paid." }, { status: 400 });
}
const amount = Math.round(balance);

// 3. Load this tenant's landlord's own M-Pesa credentials.
const { data: settings, error: settingsError } = await supabaseAdmin
  .from("landlord_payment_settings")
  .select("mpesa_enabled, mpesa_shortcode, mpesa_shortcode_type, mpesa_consumer_key, mpesa_consumer_secret, mpesa_passkey")
  .eq("landlord_id", tenant.landlord_id)
  .maybeSingle();

if (settingsError || !settings || !settings.mpesa_enabled || !settings.mpesa_shortcode || !settings.mpesa_consumer_key || !settings.mpesa_consumer_secret || !settings.mpesa_passkey) {
  return NextResponse.json({ error: "Your landlord hasn't set up M-Pesa payments yet." }, { status: 400 });
}

const shortcode = settings.mpesa_shortcode;
const passkey = settings.mpesa_passkey;
const transactionType = settings.mpesa_shortcode_type === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline";
const timestamp = timestampNow();
const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");
const phoneNumber = toSafaricomFormat(tenant.phone_number);

const accessToken = await getAccessToken(settings.mpesa_consumer_key, settings.mpesa_consumer_secret);
if (!accessToken) {
  return NextResponse.json({ error: "Could not authenticate with M-Pesa - check your landlord's API credentials." }, { status: 500 });
}

const callbackSecret = process.env.MPESA_CALLBACK_SECRET || "";
const callbackUrl = "https://managikahomes.co.ke/api/mpesa-callback?token=" + encodeURIComponent(callbackSecret);

const stkRes = await fetch("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + accessToken,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: tenant.full_name || "Managika Homes",
    TransactionDesc: "Rent Payment",
  }),
});

const stkResult = await stkRes.json();

if (stkResult.CheckoutRequestID) {
  await supabaseAdmin.from("stk_push_requests").insert({
    checkout_request_id: stkResult.CheckoutRequestID,
    merchant_request_id: stkResult.MerchantRequestID || null,
    tenant_id: tenant.id,
    invoice_id: invoice.id,
    landlord_id: tenant.landlord_id,
    amount: amount,
    status: "pending",
  });
}

return NextResponse.json(stkResult);

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to initiate payment" }, { status: 500 });
}
}
