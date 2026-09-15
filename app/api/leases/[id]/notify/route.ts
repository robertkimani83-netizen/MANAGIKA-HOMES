import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsappTemplate } from "@/lib/whatsapp";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// Notifies a tenant that a lease is waiting for them, over WhatsApp only
// (SMS deliberately left out - see Robert's instruction). Fired
// automatically right after a landlord clicks "Send to tenant"
// (app/leases/page.tsx), and re-usable as a manual "Resend notification"
// for a lease that's still unaccepted. Uses a template named "lease_ready" -
// exactly like rent_reminder and payment_confirmation, this will fail with
// a clear error from Meta until that template is created and approved in
// WhatsApp Manager (see this feature's README), but never blocks the lease
// itself from being sent - same "attempted, reported, never blocking"
// pattern as every other notification in this app.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landlordId = await authenticate(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: lease } = await supabaseAdmin
    .from("lease_agreements")
    .select("id, landlord_id, status, tenants(full_name, phone_number)")
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .maybeSingle();

  if (!lease) return NextResponse.json({ error: "Lease not found" }, { status: 404 });

  const tenant = (lease as any).tenants;
  if (!tenant?.phone_number) {
    return NextResponse.json({ error: "This tenant has no phone number on file." }, { status: 400 });
  }

  let whatsapp: { ok: boolean; error?: string } = { ok: false, error: "not attempted" };
  try {
    const waResult = await sendWhatsappTemplate(tenant.phone_number, "lease_ready", "en", [tenant.full_name || "there"]);
    whatsapp = waResult.ok ? { ok: true } : { ok: false, error: waResult.error };
  } catch (waError: any) {
    whatsapp = { ok: false, error: waError?.message || "WhatsApp request failed" };
  }

  if (!whatsapp.ok) {
    return NextResponse.json({ success: false, error: "WhatsApp message failed: " + whatsapp.error, whatsapp }, { status: 502 });
  }

  return NextResponse.json({ success: true, whatsapp });
}
