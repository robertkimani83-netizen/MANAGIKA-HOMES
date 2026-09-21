import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { phoneVariants } from "@/lib/tenant-phone";
import { nairobiPeriod } from "@/lib/period";
import { paybillAccount, toPaybillInfo } from "@/lib/paybill";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Kept in sync with currentPeriod() in app/tenant/dashboard/page.tsx.
function currentPeriod() {
  // Kenya-time month (servers run in UTC) - see lib/period.ts.
  return nairobiPeriod();
}

export async function GET(request: Request) {
const authHeader = request.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
const authedUser = userData?.user;
if (userError || !authedUser || (!authedUser.email && !authedUser.phone)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Tenant may be signed in with either identifier - match on whichever the
// account has (phone-only accounts have no email on file).
let tenantQuery = supabaseAdmin.from("tenants").select("id, landlord_id, unit_id");
tenantQuery = authedUser.email
  ? tenantQuery.eq("email", authedUser.email)
  : tenantQuery.in("phone_number", phoneVariants(authedUser.phone as string));
const { data: tenant, error: tenantError } = await tenantQuery.maybeSingle();
if (tenantError || !tenant || !tenant.landlord_id) {
  return NextResponse.json({ mpesa_enabled: false, bank_enabled: false });
}

// Has this tenant already tapped "I've Paid" for the current billing
// period? Lets the dashboard show "waiting for confirmation" instead of
// the button again after a refresh.
const { data: pendingClaim } = await supabaseAdmin
  .from("payment_claims")
  .select("id")
  .eq("tenant_id", tenant.id)
  .eq("billing_period", currentPeriod())
  .eq("status", "pending")
  .maybeSingle();
const has_pending_claim = !!pendingClaim;

const { data: settings } = await supabaseAdmin
  .from("landlord_payment_settings")
  .select("mpesa_enabled, manual_mpesa_enabled, manual_mpesa_type, manual_mpesa_number, manual_mpesa_name, bank_enabled, bank_name, bank_account_name, bank_account_number, bank_branch, paybill_number, paybill_account")
  .eq("landlord_id", tenant.landlord_id)
  .maybeSingle();

if (!settings) {
  return NextResponse.json({ mpesa_enabled: false, manual_mpesa_enabled: false, bank_enabled: false, has_pending_claim });
}

// Paybill instructions for THIS tenant: the landlord's Paybill plus an account
// that ends in this tenant's own unit number (e.g. 27833#A14).
let paybillNumber = "";
let paybillAcc = "";
const paybillInfo = toPaybillInfo(settings);
if (paybillInfo) {
  let unitNumber = "";
  if ((tenant as any).unit_id) {
    const { data: unitRow } = await supabaseAdmin.from("units").select("unit_number").eq("id", (tenant as any).unit_id).maybeSingle();
    unitNumber = unitRow?.unit_number || "";
  }
  if (unitNumber) {
    paybillNumber = paybillInfo.paybill;
    paybillAcc = paybillAccount(paybillInfo, unitNumber);
  }
}

return NextResponse.json({
  paybill_enabled: !!paybillNumber,
  paybill_number: paybillNumber,
  paybill_account: paybillAcc,
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
  has_pending_claim,
});
}
