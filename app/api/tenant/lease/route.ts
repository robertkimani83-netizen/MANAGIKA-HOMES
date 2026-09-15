import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { phoneVariants } from "@/lib/tenant-phone";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const MAX_SIGNATURE_BYTES = 250_000; // ~250KB is generous for a drawn signature PNG

// lease_agreements has no tenant-facing RLS policy (see the migration
// comment) since tenants aren't matched by auth.uid() the way landlords
// are - so both read and accept go through this service-role route,
// same pattern as report-payment.
async function resolveTenant(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  const authedUser = userData?.user;
  if (userError || !authedUser || (!authedUser.email && !authedUser.phone)) return null;

  let tenantQuery = supabaseAdmin.from("tenants").select("id");
  tenantQuery = authedUser.email
    ? tenantQuery.eq("email", authedUser.email)
    : tenantQuery.in("phone_number", phoneVariants(authedUser.phone as string));
  const { data: tenant } = await tenantQuery.maybeSingle();
  return tenant?.id || null;
}

export async function GET(request: Request) {
  const tenantId = await resolveTenant(request);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: lease, error } = await supabaseAdmin
    .from("lease_agreements")
    .select(
      "id, terms_text, monthly_rent, start_date, end_date, status, accepted_full_name, accepted_at, created_at, signature_data_url, signed_hash"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lease: lease || null });
}

// Computes a SHA-256 fingerprint of the exact terms a tenant is agreeing to
// at the moment they sign - printed on the signed PDF (lib/lease-pdf.ts) so
// the signed content can be verified later, and to make silent post-signing
// edits to the terms detectable rather than invisible.
function fingerprintLease(params: {
  termsText: string;
  monthlyRent: number | null;
  startDate: string | null;
  endDate: string | null;
  tenantId: string;
  landlordId: string;
}) {
  const payload = [
    params.termsText,
    params.monthlyRent ?? "",
    params.startDate ?? "",
    params.endDate ?? "",
    params.tenantId,
    params.landlordId,
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function POST(request: Request) {
  const tenantId = await resolveTenant(request);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const fullName = (body?.fullName || "").trim();
  const signatureDataUrl = typeof body?.signatureDataUrl === "string" ? body.signatureDataUrl : "";

  if (!fullName) return NextResponse.json({ error: "Type your full name to accept." }, { status: 400 });
  if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "Draw your signature to accept." }, { status: 400 });
  }
  if (signatureDataUrl.length > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ error: "Signature image is too large." }, { status: 400 });
  }

  const { data: lease } = await supabaseAdmin
    .from("lease_agreements")
    .select("id, status, terms_text, monthly_rent, start_date, end_date, landlord_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lease) return NextResponse.json({ error: "No lease found to accept." }, { status: 404 });
  if (lease.status === "accepted") return NextResponse.json({ success: true, alreadyAccepted: true });

  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const signedIp = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  const signedUserAgent = request.headers.get("user-agent") || null;
  const signedHash = fingerprintLease({
    termsText: lease.terms_text,
    monthlyRent: lease.monthly_rent,
    startDate: lease.start_date,
    endDate: lease.end_date,
    tenantId,
    landlordId: lease.landlord_id,
  });

  const { error } = await supabaseAdmin
    .from("lease_agreements")
    .update({
      status: "accepted",
      accepted_full_name: fullName,
      accepted_at: new Date().toISOString(),
      signature_data_url: signatureDataUrl,
      signed_ip: signedIp,
      signed_user_agent: signedUserAgent,
      signed_hash: signedHash,
    })
    .eq("id", lease.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
