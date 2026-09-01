import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Turns a pending invite into a real, working login. No auth header here
// on purpose - whoever holds the invite link isn't signed in to anything
// yet. The token itself (24 random bytes, unguessable) is what proves
// they're the intended recipient, same trust model as a password-reset
// link.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = (body.token || "").trim();
    const password = body.password || "";

    if (!token) return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("landlord_staff")
      .select("id, landlord_id, full_name, email, status")
      .eq("invite_token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "This invite link is invalid." }, { status: 404 });
    }
    if (invite.status !== "invited") {
      return NextResponse.json({ error: "This invite has already been used or was revoked. Ask your landlord to send a new one." }, { status: 409 });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const alreadyExists = /already|exists|registered/i.test(createError.message || "");
      return NextResponse.json(
        { error: alreadyExists ? "An account with this email already exists. Try signing in instead." : createError.message },
        { status: alreadyExists ? 409 : 500 }
      );
    }

    const { error: linkError } = await supabaseAdmin
      .from("landlord_staff")
      .update({ status: "active", auth_user_id: created.user!.id, accepted_at: new Date().toISOString(), invite_token: null })
      .eq("id", invite.id);

    if (linkError) {
      return NextResponse.json({ error: "Account created, but could not finish linking it. Contact your landlord." }, { status: 500 });
    }

    return NextResponse.json({ success: true, email: invite.email, landlordFullName: invite.full_name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to accept invite" }, { status: 500 });
  }
}
