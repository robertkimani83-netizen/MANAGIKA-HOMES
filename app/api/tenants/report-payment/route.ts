import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { phoneVariants } from "@/lib/tenant-phone";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Kept in sync with currentPeriod() in app/tenant/dashboard/page.tsx and
// app/payments/page.tsx - all three need to agree on the same string for a
// claim to line up with the right invoice.
function currentPeriod() {
  const d = new Date();
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return names[d.getMonth()] + " " + d.getFullYear();
}

// A tenant with no in-app M-Pesa STK Push (mpesa_enabled) has no way to pay
// automatically - they send money via the manual M-Pesa number or bank
// transfer the landlord configured, then tap "I've Paid" here so the
// landlord sees it and can confirm it in their Payments page. This never
// marks an invoice paid by itself - it only notifies the landlord.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  const authedUser = userData?.user;
  if (userError || !authedUser || (!authedUser.email && !authedUser.phone)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const method = body?.method === "bank" ? "bank" : "manual_mpesa";

  let tenantQuery = supabaseAdmin.from("tenants").select("id, landlord_id");
  tenantQuery = authedUser.email
    ? tenantQuery.eq("email", authedUser.email)
    : tenantQuery.in("phone_number", phoneVariants(authedUser.phone as string));
  const { data: tenant, error: tenantError } = await tenantQuery.maybeSingle();
  if (tenantError || !tenant || !tenant.landlord_id) return NextResponse.json({ error: "Tenant record not found" }, { status: 404 });

  const period = currentPeriod();

  // Avoid piling up duplicate claims if the tenant taps the button more
  // than once for the same billing period.
  const { data: existingClaim } = await supabaseAdmin
    .from("payment_claims")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("billing_period", period)
    .eq("status", "pending")
    .maybeSingle();

  if (existingClaim) {
    return NextResponse.json({ success: true, alreadyReported: true });
  }

  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("id, total_due")
    .eq("tenant_id", tenant.id)
    .eq("billing_period", period)
    .maybeSingle();

  const { error: insertError } = await supabaseAdmin.from("payment_claims").insert({
    tenant_id: tenant.id,
    landlord_id: tenant.landlord_id,
    invoice_id: invoice?.id || null,
    billing_period: period,
    amount: invoice ? Number(invoice.total_due) : null,
    method,
    status: "pending",
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
