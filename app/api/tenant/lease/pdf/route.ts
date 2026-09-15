import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { phoneVariants } from "@/lib/tenant-phone";
import { generateLeasePdf } from "@/lib/lease-pdf";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

async function resolveTenant(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  const authedUser = userData?.user;
  if (userError || !authedUser || (!authedUser.email && !authedUser.phone)) return null;

  let tenantQuery = supabaseAdmin.from("tenants").select("id, full_name");
  tenantQuery = authedUser.email
    ? tenantQuery.eq("email", authedUser.email)
    : tenantQuery.in("phone_number", phoneVariants(authedUser.phone as string));
  const { data: tenant } = await tenantQuery.maybeSingle();
  return tenant || null;
}

export async function GET(request: Request) {
  const tenant = await resolveTenant(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: lease } = await supabaseAdmin
    .from("lease_agreements")
    .select(
      "id, terms_text, monthly_rent, start_date, end_date, status, accepted_full_name, accepted_at, created_at, signature_data_url, signed_ip, signed_user_agent, signed_hash, units(unit_number)"
    )
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lease) return NextResponse.json({ error: "No lease found." }, { status: 404 });

  const pdfBytes = await generateLeasePdf({
    tenantName: tenant.full_name,
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
