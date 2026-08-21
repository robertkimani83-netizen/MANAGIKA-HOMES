import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
const body = await request.json();
const { tenantId, invoiceId, phoneNumber, amount, accountReference } = body;

if (!tenantId || !phoneNumber || !amount) {
  return NextResponse.json({ error: "Missing tenantId, phoneNumber or amount" }, { status: 400 });
}

const { data: tenant, error: tenantError } = await supabaseAdmin.from("tenants").select("id, landlord_id").eq("id", tenantId).maybeSingle();
if (tenantError || !tenant || !tenant.landlord_id) {
  return NextResponse.json({ error: "Could not find your tenant record" }, { status: 400 });
}

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

const accessToken = await getAccessToken(settings.mpesa_consumer_key, settings.mpesa_consumer_secret);
if (!accessToken) {
  return NextResponse.json({ error: "Could not authenticate with M-Pesa - check your landlord's API credentials." }, { status: 500 });
}

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
    CallBackURL: "https://managikahomes.co.ke/api/mpesa-callback",
    AccountReference: accountReference || "Managika Homes",
    TransactionDesc: "Rent Payment",
  }),
});

const stkResult = await stkRes.json();

if (stkResult.CheckoutRequestID) {
  await supabaseAdmin.from("stk_push_requests").insert({
    checkout_request_id: stkResult.CheckoutRequestID,
    merchant_request_id: stkResult.MerchantRequestID || null,
    tenant_id: tenant.id,
    invoice_id: invoiceId || null,
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
