import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsappTemplate } from "@/lib/whatsapp";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Sends the payment_confirmation WhatsApp template for a payment the
// landlord just recorded manually (app/payments/page.tsx). The M-Pesa STK
// flow has its own equivalent send baked into app/api/mpesa-callback -
// this route exists only for the manual-entry path, since that one runs
// client-side via the RLS-scoped supabase client and has no server-held
// WHATSAPP_ACCESS_TOKEN to call the Cloud API with directly.
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
  .select("id, billing_period, status, unit_id, tenants!inner(id, full_name, phone_number, landlord_id)")
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

const result = await sendWhatsappTemplate(tenant.phone_number, "payment_confirmation", "en", [
  tenant.full_name || "there",
  Number(amountPaid).toLocaleString(),
  invoice.billing_period || "",
  unitNumber,
  (reference || "").toString().trim() || "-",
]);

if (!result.ok) {
  return NextResponse.json({ success: false, error: result.error }, { status: 502 });
}

return NextResponse.json({ success: true, messageId: result.messageId });

} catch (error: any) {
return NextResponse.json({ error: error.message || "Failed to send WhatsApp confirmation" }, { status: 500 });
}
}
