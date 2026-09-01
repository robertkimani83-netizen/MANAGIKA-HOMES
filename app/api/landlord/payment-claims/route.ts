import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

// Tenant-reported payments waiting on the landlord to confirm - fed by
// tenants tapping "I've Paid" on the manual M-Pesa / bank transfer
// instructions in their dashboard (app/api/tenants/report-payment).
export async function GET(request: Request) {
  const landlordId = await getLandlordId(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("payment_claims")
    .select("id, billing_period, amount, method, status, created_at, tenants(full_name, phone_number, units(unit_number))")
    .eq("landlord_id", landlordId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claims: data || [] });
}

// Landlord confirms ("this really was paid" - records it exactly like the
// existing manual "Record Payment" flow in app/payments/page.tsx) or
// dismisses (mistaken/duplicate report) a tenant's claim.
export async function POST(request: Request) {
  const landlordId = await getLandlordId(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const claimId = body?.claimId;
  const action = body?.action;
  if (!claimId || (action !== "confirm" && action !== "dismiss")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: claim, error: claimError } = await supabaseAdmin
    .from("payment_claims")
    .select("id, tenant_id, invoice_id, billing_period, amount, method, status")
    .eq("id", claimId)
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (claimError || !claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (claim.status !== "pending") return NextResponse.json({ error: "This claim was already resolved." }, { status: 409 });

  if (action === "dismiss") {
    const { error } = await supabaseAdmin.from("payment_claims").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", claimId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // action === "confirm" - same invoice-then-payment logic as recordPayment()
  // in app/payments/page.tsx, just driven by the claim instead of a form.
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, unit_id, units(base_rent)")
    .eq("id", claim.tenant_id)
    .maybeSingle();
  if (tenantError || !tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  let invoiceId = claim.invoice_id as string | null;
  let totalDue = claim.amount ? Number(claim.amount) : 0;

  if (!invoiceId) {
    const rent = Number((tenant as any).units?.base_rent) || 0;
    const period = claim.billing_period || "";
    const { data: existingInvoice } = await supabaseAdmin.from("invoices").select("id, total_due").eq("tenant_id", tenant.id).eq("billing_period", period).maybeSingle();
    if (existingInvoice) {
      invoiceId = existingInvoice.id;
      totalDue = Number(existingInvoice.total_due);
    } else {
      const { data: newInvoice, error: invError } = await supabaseAdmin
        .from("invoices")
        .insert({ invoice_number: "INV-" + Date.now(), tenant_id: tenant.id, unit_id: tenant.unit_id, billing_period: period, rent_amount: rent, total_due: rent, status: "unpaid", due_date: new Date().toISOString().slice(0, 10) })
        .select("id, total_due")
        .single();
      if (invError || !newInvoice) return NextResponse.json({ error: invError?.message || "Could not create invoice" }, { status: 500 });
      invoiceId = newInvoice.id;
      totalDue = Number(newInvoice.total_due);
    }
  }

  const amountToRecord = body.amount ? Number(body.amount) : (totalDue || Number(claim.amount) || 0);
  const paymentMethod = claim.method === "bank" ? "bank_transfer" : "mpesa";

  const { error: payError } = await supabaseAdmin.from("payments").insert({ invoice_id: invoiceId, amount_paid: amountToRecord, payment_method: paymentMethod, transaction_reference: body.reference || null });
  if (payError) return NextResponse.json({ error: payError.message }, { status: 500 });

  const { data: invoicePayments } = await supabaseAdmin.from("payments").select("amount_paid").eq("invoice_id", invoiceId);
  const totalPaid = (invoicePayments || []).reduce((sum, p: any) => sum + (Number(p.amount_paid) || 0), 0);
  let newStatus = "unpaid";
  if (totalDue > 0 && totalPaid >= totalDue) newStatus = "paid";
  else if (totalPaid > 0) newStatus = "partially_paid";
  await supabaseAdmin.from("invoices").update({ status: newStatus }).eq("id", invoiceId);

  const { error: resolveError } = await supabaseAdmin.from("payment_claims").update({ status: "confirmed", resolved_at: new Date().toISOString() }).eq("id", claimId);
  if (resolveError) return NextResponse.json({ error: resolveError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
