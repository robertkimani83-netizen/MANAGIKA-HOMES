import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendPaymentConfirmation, paymentBalanceText } from "@/lib/payment-confirmation";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Sends the payment-confirmation message (WhatsApp AND SMS, fired together)
// for a payment the landlord just recorded manually (app/payments/page.tsx).
// The M-Pesa STK flow has its own equivalent send baked into
// app/api/mpesa-callback - this route exists only for the manual-entry path,
// since that one runs client-side via the RLS-scoped supabase client and has
// no server-held WHATSAPP_ACCESS_TOKEN/AFRICASTALKING_API_KEY to call those
// APIs with directly.
export async function POST(request: Request) {
try {
// Only a logged-in landlord may trigger this, and only for one of their
// own tenants' invoices - the tenant's name/phone/unit are always looked
// up from our own records below, never taken from the request body.
const authHeader = request.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const body = await request.json();
const { invoiceId, amountPaid, reference } = body;
if (!invoiceId || !amountPaid) {
  return NextResponse.json({ error: "Missing invoiceId or amountPaid" }, { status: 400 });
}

const { data: invoice, error: invoiceError } = await supabaseAdmin
  .from("invoices")
  .select("id, billing_period, status, unit_id, total_due, tenants!inner(id, full_name, phone_number, landlord_id)")
  .eq("id", invoiceId)
  .maybeSingle();

if (invoiceError || !invoice) {
  return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
}

const tenant = Array.isArray((invoice as any).tenants) ? (invoice as any).tenants[0] : (invoice as any).tenants;
if (!tenant || tenant.landlord_id !== userData.user.id) {
  return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
}
if (!tenant.phone_number) {
  return NextResponse.json({ error: "This tenant has no phone number on file." }, { status: 400 });
}

let unitNumber = "";
if (invoice.unit_id) {
  const { data: unitRow } = await supabaseAdmin.from("units").select("unit_number").eq("id", invoice.unit_id).maybeSingle();
  unitNumber = unitRow?.unit_number || "";
}

// The balance line tells the tenant whether this payment settled the
// invoice or left a balance still owed - based on every payment recorded
// against this invoice, not just the one just entered.
const { data: invoicePayments } = await supabaseAdmin
  .from("payments")
  .select("amount_paid")
  .eq("invoice_id", invoiceId);
const totalPaid = (invoicePayments || []).reduce((sum, p: any) => sum + (Number(p.amount_paid) || 0), 0);
const balanceText = paymentBalanceText(invoice.total_due, totalPaid);

const { whatsapp, sms } = await sendPaymentConfirmation(tenant.phone_number, {
  fullName: tenant.full_name || "there",
  amount: Number(amountPaid).toLocaleString(),
  period: invoice.billing_period || "",
  unitNumber,
  reference: (reference || "").toString().trim() || "-",
  balanceText,
});

// Both channels were attempted together; only report failure if NEITHER
// reached the tenant. Either result is included either way so a caller that
// wants to know per-channel status can (the current caller in
// app/payments/page.tsx ignores this body today and treats the send as
// best-effort).
if (!whatsapp.ok && !sms.ok) {
  return NextResponse.json({ success: false, whatsapp, sms }, { status: 502 });
}

return NextResponse.json({ success: true, whatsapp, sms });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to send WhatsApp confirmation" }, { status: 500 });
}
}
