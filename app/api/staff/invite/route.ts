import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

// Landlord invites someone (caretaker, family member, staff) to a
// read-only view of their portfolio. No email is sent - this app has no
// email-sending infrastructure - so the landlord copies the returned
// link and shares it themselves (WhatsApp, SMS, however they'd
// normally reach that person). The link is only useful to whoever holds
// it, and only until the landlord revokes it.
export async function POST(request: Request) {
  const landlordId = await getLandlordId(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const fullName = (body.fullName || "").trim();
  const email = (body.email || "").trim().toLowerCase();

  if (!fullName || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Please provide a name and a valid email address." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("landlord_staff")
    .select("id, status")
    .eq("landlord_id", landlordId)
    .eq("email", email)
    .maybeSingle();

  if (existing && existing.status !== "revoked") {
    return NextResponse.json({ error: "This person has already been invited or already has access." }, { status: 409 });
  }

  const inviteToken = randomBytes(24).toString("hex");

  if (existing) {
    // Re-inviting someone whose access was revoked - reuse the row.
    // Deliberately NOT clearing auth_user_id: their Supabase Auth account
    // from the first time they accepted still exists (accounts are never
    // deleted on revoke), so /api/staff/accept needs to find it again to
    // reset their password instead of trying to create a duplicate
    // account with the same email, which Supabase would reject.
    const { error } = await supabaseAdmin
      .from("landlord_staff")
      .update({ full_name: fullName, invite_token: inviteToken, status: "invited", accepted_at: null })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("landlord_staff").insert({
      landlord_id: landlordId,
      full_name: fullName,
      email,
      invite_token: inviteToken,
      status: "invited",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const inviteLink = "https://managikahomes.co.ke/staff/accept?token=" + inviteToken;
  return NextResponse.json({ success: true, inviteLink });
}

// Landlord revokes an existing staff member's access.
export async function DELETE(request: Request) {
  const landlordId = await getLandlordId(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("landlord_staff")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("landlord_id", landlordId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
