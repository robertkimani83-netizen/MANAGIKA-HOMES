import { NextResponse } from "next/server";
import AfricasTalking from "africastalking";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhone, phoneVariants } from "@/lib/tenant-phone";

// Step 1 of phone-based password reset for tenants who signed up with a
// phone number instead of an email. Supabase Auth's own phone-recovery
// flow needs an SMS provider configured in the Supabase dashboard, which
// this project doesn't have (phone signup here trusts the number the
// landlord recorded instead of verifying it by OTP) - so this reuses the
// Africa's Talking account already wired up for rent reminders to
// deliver a 6-digit code instead.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(body.phone || "");
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid phone number, e.g. 07XXXXXXXX." }, { status: 400 });
    }

    // Always the same response whether or not this number belongs to a
    // tenant, so this endpoint can't be used to check who's registered.
    const genericResponse = NextResponse.json({
      success: true,
      message: "If that phone number has an account, we've sent a reset code by SMS.",
    });

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .in("phone_number", phoneVariants(phone))
      .maybeSingle();

    if (!tenant) {
      return genericResponse;
    }

    // Don't let repeated requests spam SMS to the same number.
    const { data: recent } = await supabaseAdmin
      .from("password_reset_codes")
      .select("id, created_at")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent && Date.now() - new Date(recent.created_at).getTime() < 60 * 1000) {
      return genericResponse;
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabaseAdmin.from("password_reset_codes").insert({
      phone_number: phone,
      code,
      expires_at: expiresAt,
    });

    try {
      const africastalking = AfricasTalking({
        apiKey: process.env.AFRICASTALKING_API_KEY as string,
        username: process.env.AFRICASTALKING_USERNAME as string,
      });
      const senderId = process.env.AFRICASTALKING_SENDER_ID;
      await africastalking.SMS.send({
        to: [phone],
        message: "Your Managika Homes password reset code is " + code + ". It expires in 10 minutes. Didn't request this? You can ignore this message.",
        ...(senderId ? { from: senderId } : {}),
      });
    } catch {
      // Swallow SMS delivery failures - still return the generic success
      // response so this endpoint never reveals whether the number exists.
    }

    return genericResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
