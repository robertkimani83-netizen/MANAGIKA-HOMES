import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Prices are fixed here on the server — never trusted from the client.
// Must match the numbers shown on /for-landlords.
const PLAN_PRICES: Record<string, number> = {
  starter: 1500,
  growth: 3000,
  portfolio: 6500,
};

// Annual billing gets 20% off, matching the "Pay annually and save 20%"
// copy on the /for-landlords pricing page.
const ANNUAL_DISCOUNT = 0.2;

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
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const landlordId = userData.user.id;

    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from("landlords")
      .select("id, phone_number")
      .eq("id", landlordId)
      .maybeSingle();
    if (landlordError || !landlord) {
      return NextResponse.json({ error: "Could not find your landlord account" }, { status: 400 });
    }

    const body = await request.json();
    const plan = body.plan;
    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";
    const phoneNumber = (body.phoneNumber || landlord.phone_number || "").toString();

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json({ error: "Choose a valid plan (starter, growth, or portfolio)" }, { status: 400 });
    }
    if (!phoneNumber) {
      return NextResponse.json({ error: "Missing phone number to send the payment prompt to" }, { status: 400 });
    }

    const monthlyAmount = PLAN_PRICES[plan];
    const amount =
      billingCycle === "annual"
        ? Math.round(monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT))
        : monthlyAmount;

    const shortcode = process.env.MANAGIKA_MPESA_SHORTCODE;
    const shortcodeType = process.env.MANAGIKA_MPESA_SHORTCODE_TYPE || "paybill";
    const consumerKey = process.env.MANAGIKA_MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MANAGIKA_MPESA_CONSUMER_SECRET;
    const passkey = process.env.MANAGIKA_MPESA_PASSKEY;
    const callbackSecret = process.env.MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET;

    if (!shortcode || !consumerKey || !consumerSecret || !passkey || !callbackSecret) {
      return NextResponse.json({ error: "Subscription payments aren't switched on yet. Check back soon." }, { status: 503 });
    }

    const transactionType = shortcodeType === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline";
    const timestamp = timestampNow();
    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

    const accessToken = await getAccessToken(consumerKey, consumerSecret);
    if (!accessToken) {
      return NextResponse.json({ error: "Could not authenticate with M-Pesa" }, { status: 500 });
    }

    const callbackUrl = "https://managikahomes.co.ke/api/subscription-callback?token=" + encodeURIComponent(callbackSecret);

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
        AccountReference: "Managika-" + plan,
        TransactionDesc: "Managika Homes " + plan + " plan",
      }),
    });

    const stkResult = await stkRes.json();

    if (stkResult.CheckoutRequestID) {
      await supabaseAdmin.from("subscription_stk_requests").insert({
        checkout_request_id: stkResult.CheckoutRequestID,
        merchant_request_id: stkResult.MerchantRequestID || null,
        landlord_id: landlordId,
        plan,
        billing_cycle: billingCycle,
        amount,
        status: "pending",
      });

      await supabaseAdmin.from("landlord_subscriptions").upsert(
        {
          landlord_id: landlordId,
          plan,
          billing_cycle: billingCycle,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "landlord_id" }
      );
    }

    return NextResponse.json(stkResult);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to start payment" }, { status: 500 });
  }
}
