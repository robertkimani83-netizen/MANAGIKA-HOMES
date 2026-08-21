import { NextResponse } from "next/server";

async function getAccessToken() {
const consumerKey = process.env.MPESA_CONSUMER_KEY as string;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET as string;
const auth = Buffer.from(consumerKey + ":" + consumerSecret).toString("base64");

const res = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
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
const { phoneNumber, amount, accountReference } = body;

if (!phoneNumber || !amount) {
  return NextResponse.json({ error: "Missing phoneNumber or amount" }, { status: 400 });
}

const shortcode = process.env.MPESA_SHORTCODE as string;
const passkey = process.env.MPESA_PASSKEY as string;
const timestamp = timestampNow();
const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

const accessToken = await getAccessToken();

const stkRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + accessToken,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
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
return NextResponse.json(stkResult);

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to initiate payment" }, { status: 500 });
}
}