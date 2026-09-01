import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { secureCompare } from "@/lib/secure-compare";
import { normalizePhone, phoneVariants } from "@/lib/tenant-phone";

// Step 2: verify the code the tenant received by SMS and, if it checks
// out, set their new password directly via the admin API. There's no
// authenticated session to update here - forgetting the password is the
// whole reason they're going through this flow - so the SMS code is what
// proves they're the phone's real owner.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(body.phone || "");
    const code = String(body.code || "").trim();
    const password = body.password || "";

    if (!phone) {
      return NextResponse.json({ error: "Enter a valid phone number, e.g. 07XXXXXXXX." }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "Enter the code we sent you." }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const { data: codeRow } = await supabaseAdmin
      .from("password_reset_codes")
      .select("id, code, attempts, expires_at, used")
      .eq("phone_number", phone)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!codeRow || new Date(codeRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "That code has expired. Please request a new one." }, { status: 400 });
    }
    if (codeRow.attempts >= 5) {
      return NextResponse.json({ error: "Too many incorrect attempts. Please request a new code." }, { status: 429 });
    }
    if (!secureCompare(code, codeRow.code)) {
      await supabaseAdmin.from("password_reset_codes").update({ attempts: codeRow.attempts + 1 }).eq("id", codeRow.id);
      return NextResponse.json({ error: "That code is incorrect." }, { status: 400 });
    }

    await supabaseAdmin.from("password_reset_codes").update({ used: true }).eq("id", codeRow.id);

    // Supabase's admin API has no "find user by phone" lookup, so scan
    // pages of users and match against every format this app has ever
    // stored a phone number in. This project's user count is nowhere
    // near large enough for this to be a real cost.
    const variants = new Set(phoneVariants(phone).map((v) => v.replace(/^\+/, "")));
    let targetUserId: string | null = null;
    for (let page = 1; page <= 10 && !targetUserId; page++) {
      const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError || !usersPage || usersPage.users.length === 0) break;
      const match = usersPage.users.find((u) => u.phone && variants.has(u.phone.replace(/^\+/, "")));
      if (match) {
        targetUserId = match.id;
        break;
      }
      if (usersPage.users.length < 1000) break;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "No account found for this phone number yet. Please sign up instead." }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
