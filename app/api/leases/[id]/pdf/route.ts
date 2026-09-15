import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateLeasePdf } from "@/lib/lease-pdf";

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landlordId = await authenticate(request);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: lease } = await supabaseAdmin
    .from("lease_agreements")
    .select(
      "id, terms_text, monthly_rent, start_date, end_date, status, accepted_full_name, accepted_at, created_at, signature_data_url, signed_ip, signed_user_agent, signed_hash, landlord_id, tenants(full_name), units(unit_number)"
    )
    .eq("id", id)
    .eq("landlord_id", landlordId)
    .maybeSingle();

  if (!lease) return NextResponse.json({ error: "Lease not found" }, { status: 404 });

  const pdfBytes = await generateLeasePdf({
    tenantName: (lease as any).tenants?.full_name || "Tenant",
    unitLabel: (lease as any).units?.unit_number || null,
    monthlyRent: lease.monthly_rent,
    startDate: lease.start_date,
    endDate: lease.end_date,
    termsText: lease.terms_text,
    status: lease.status,
    acceptedFullName: lease.accepted_full_name,
    acceptedAt: lease.accepted_at,
    signatureDataUrl: lease.signature_data_url,
    signedIp: lease.signed_ip,
    signedUserAgent: lease.signed_user_agent,
    signedHash: lease.signed_hash,
    createdAt: lease.created_at,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="managika-lease-agreement.pdf"',
    },
  });
}
