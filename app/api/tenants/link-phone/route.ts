import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizePhone } from "@/lib/tenant-phone";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Links the calling tenant's Supabase Auth account to the phone number their
// landlord recorded for them, so they can sign in with either their email or
// their phone number going forward. Safe to call every time the tenant logs
// in - it's a no-op once the phone is already linked.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = userData.user;
    if (user.phone) {
      return NextResponse.json({ linked: true, alreadyLinked: true });
    }
    if (!user.email) {
      return NextResponse.json({ linked: false, reason: "No email on account" });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("phone_number")
      .eq("email", user.email)
      .maybeSingle();

    if (tenantError || !tenant || !tenant.phone_number) {
      return NextResponse.json({ linked: false, reason: "No tenant phone number on file" });
    }

    const phone = normalizePhone(tenant.phone_number);
    if (!phone) {
      return NextResponse.json({ linked: false, reason: "Phone number on file is not a valid Kenyan number" });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      phone,
      phone_confirm: true,
    });

    if (updateError) {
      // Most likely cause: this phone number is already linked to a different
      // auth account (e.g. duplicate phone across tenant rows). Don't fail
      // the caller's flow over this - just report it wasn't linked.
      return NextResponse.json({ linked: false, reason: updateError.message });
    }

    return NextResponse.json({ linked: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to link phone number" }, { status: 500 });
  }
}
