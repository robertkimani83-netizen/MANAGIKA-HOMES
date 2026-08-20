import { NextResponse } from "next/server";
import AfricasTalking from "africastalking";

export async function POST(request: Request) {
try {
const body = await request.json();
const { phoneNumber, message } = body;

if (!phoneNumber || !message) {
  return NextResponse.json({ error: "Missing phoneNumber or message" }, { status: 400 });
}

const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY as string,
  username: process.env.AFRICASTALKING_USERNAME as string,
});

const sms = africastalking.SMS;

const result = await sms.send({
  to: [phoneNumber],
  message: message,
});

return NextResponse.json({ success: true, result });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to send SMS" }, { status: 500 });
}
}