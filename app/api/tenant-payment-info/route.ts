import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

export async function GET(request: Request) {
const authHeader = request.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
if (userError || !userData.user || !userData.user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: tenant, error: tenantError } = await supabaseAdmin.from("tenants").select("id, landlord_id").eq("email", userData.user.email).maybeSingle();
if (tenantError || !tenant || !tenant.landlord_id) {
  return NextResponse.json({ mpesa_enabled: false, bank_enabled: false });
}

const { data: settings } = await supabaseAdmin
  .from("landlord_payment_settings")
  .select("mpesa_enabled, manual_mpesa_enabled, manual_mpesa_type, manual_mpesa_number, manual_mpesa_name, bank_enabled, bank_name, bank_account_name, bank_account_number, bank_branch")
  .eq("landlord_id", tenant.landlord_id)
  .maybeSingle();

if (!settings) {
  return NextResponse.json({ mpesa_enabled: false, manual_mpesa_enabled: false, bank_enabled: false });
}

return NextResponse.json({
  mpesa_enabled: !!settings.mpesa_enabled,
  manual_mpesa_enabled: !!settings.manual_mpesa_enabled,
  manual_mpesa_type: settings.manual_mpesa_type || "till",
  manual_mpesa_number: settings.manual_mpesa_number || "",
  manual_mpesa_name: settings.manual_mpesa_name || "",
  bank_enabled: !!settings.bank_enabled,
  bank_name: settings.bank_name || "",
  bank_account_name: settings.bank_account_name || "",
  bank_account_number: settings.bank_account_number || "",
  bank_branch: settings.bank_branch || "",
});
}
