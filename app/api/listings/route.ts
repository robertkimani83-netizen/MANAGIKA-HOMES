import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

function publicPhotoUrl(path: string) {
  return supabaseUrl + "/storage/v1/object/public/listing-photos/" + path;
}

// No auth required - a published listing is meant to be public. Used by
// the /listings/[unitId] page a landlord shares outside the app.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");
  if (!unitId) return NextResponse.json({ error: "Missing unitId" }, { status: 400 });

  const { data: listing, error } = await supabaseAdmin
    .from("unit_listings")
    .select("id, unit_id, headline, description, contact_phone, photo_paths, is_published, units(unit_number, base_rent, properties(property_name))")
    .eq("unit_id", unitId)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  return NextResponse.json({
    unitNumber: (listing as any).units?.unit_number || null,
    propertyName: (listing as any).units?.properties?.property_name || null,
    baseRent: (listing as any).units?.base_rent || null,
    headline: listing.headline,
    description: listing.description,
    contactPhone: listing.contact_phone,
    photoUrls: (listing.photo_paths || []).map(publicPhotoUrl),
  });
}

// Landlord creates/updates the listing for one of their own units.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const landlordId = userData.user.id;

  const body = await request.json().catch(() => ({}));
  const unitId = body.unitId;
  if (!unitId) return NextResponse.json({ error: "Missing unitId" }, { status: 400 });

  const { data: unit, error: unitError } = await supabaseAdmin
    .from("units")
    .select("id, properties!inner(landlord_id)")
    .eq("id", unitId)
    .maybeSingle();
  if (unitError || !unit || (unit as any).properties?.landlord_id !== landlordId) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const update = {
    unit_id: unitId,
    landlord_id: landlordId,
    headline: (body.headline || "").trim() || null,
    description: (body.description || "").trim() || null,
    contact_phone: (body.contactPhone || "").trim() || null,
    is_published: body.isPublished !== false,
    updated_at: new Date().toISOString(),
  };

  const { data: listing, error } = await supabaseAdmin
    .from("unit_listings")
    .upsert(update, { onConflict: "unit_id" })
    .select("id, photo_paths")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, listingId: listing.id, publicUrl: "https://managikahomes.co.ke/listings/" + unitId });
}
