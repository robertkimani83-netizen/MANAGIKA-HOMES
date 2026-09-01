import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB - a phone photo, not a scanned document
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_PHOTOS = 8;

async function authenticateLandlordForUnit(request: Request, unitId: string) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: unit } = await supabaseAdmin.from("units").select("id, properties!inner(landlord_id)").eq("id", unitId).maybeSingle();
  if (!unit || (unit as any).properties?.landlord_id !== data.user.id) return null;
  return data.user.id;
}

// Adds one photo to a unit's public listing. The bucket itself is
// public (see the migration) - only the upload step is authenticated.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const unitId = formData.get("unitId");

    if (!(file instanceof File) || typeof unitId !== "string" || !unitId) {
      return NextResponse.json({ error: "Missing file or unitId" }, { status: 400 });
    }
    const landlordId = await authenticateLandlordForUnit(request, unitId);
    if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Photo is too large (8MB limit)" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Please upload a JPG, PNG, WEBP, or HEIC photo." }, { status: 400 });
    }

    const { data: listing } = await supabaseAdmin.from("unit_listings").select("id, photo_paths").eq("unit_id", unitId).maybeSingle();
    const currentPaths: string[] = listing?.photo_paths || [];
    if (currentPaths.length >= MAX_PHOTOS) {
      return NextResponse.json({ error: "This listing already has the maximum of " + MAX_PHOTOS + " photos. Remove one first." }, { status: 400 });
    }

    const safeName = (file.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = unitId + "/" + Date.now() + "-" + safeName;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage.from("listing-photos").upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });

    const newPaths = [...currentPaths, path];
    const { error: upsertError } = await supabaseAdmin
      .from("unit_listings")
      .upsert({ unit_id: unitId, landlord_id: landlordId, photo_paths: newPaths, updated_at: new Date().toISOString() }, { onConflict: "unit_id" });
    if (upsertError) {
      await supabaseAdmin.storage.from("listing-photos").remove([path]);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, photoUrl: supabaseUrl + "/storage/v1/object/public/listing-photos/" + path });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to upload photo" }, { status: 500 });
  }
}

// Removes one photo (by its storage path) from a unit's listing.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  const unitId = body.unitId;
  const path = body.path;
  if (!unitId || !path) return NextResponse.json({ error: "Missing unitId or path" }, { status: 400 });

  const landlordId = await authenticateLandlordForUnit(request, unitId);
  if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: listing } = await supabaseAdmin.from("unit_listings").select("photo_paths").eq("unit_id", unitId).maybeSingle();
  const currentPaths: string[] = listing?.photo_paths || [];
  if (!currentPaths.includes(path)) return NextResponse.json({ error: "Photo not found on this listing" }, { status: 404 });

  await supabaseAdmin.storage.from("listing-photos").remove([path]);
  const { error } = await supabaseAdmin
    .from("unit_listings")
    .update({ photo_paths: currentPaths.filter((p) => p !== path), updated_at: new Date().toISOString() })
    .eq("unit_id", unitId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
