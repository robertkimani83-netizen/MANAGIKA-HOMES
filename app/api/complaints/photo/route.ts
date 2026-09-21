import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { phoneVariants } from "@/lib/tenant-phone";
import { allowRequest } from "@/lib/rate-limit";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const MAX_FILE_BYTES = 3 * 1024 * 1024; // the tenant's phone shrinks the photo first, so this is generous
const BUCKET = "complaint-photos";

// Uploads the photo a tenant attaches to a complaint. The bucket is private, so
// the photo can only be opened later through the landlord's own signed link
// (/api/complaints/[id]/photo). Returns the stored path, which the tenant's
// page then saves on the complaint.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    const authedUser = userData?.user;
    if (userError || !authedUser || (!authedUser.email && !authedUser.phone)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let tenantQuery = supabaseAdmin.from("tenants").select("id, unit_id");
    tenantQuery = authedUser.email ? tenantQuery.eq("email", authedUser.email) : tenantQuery.in("phone_number", phoneVariants(authedUser.phone as string));
    const { data: tenant, error: tenantError } = await tenantQuery.maybeSingle();
    if (tenantError || !tenant || !tenant.unit_id) return NextResponse.json({ error: "Tenant record not found" }, { status: 404 });

    // Ten photos an hour is far more than a real complaint needs.
    if (!(await allowRequest("complaint-photo:" + tenant.id, 10, 3600))) {
      return NextResponse.json({ error: "Too many photos in a short time. Please try again later." }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "That photo is too large." }, { status: 400 });

    // Only a real JPEG (the page converts every photo to one before sending).
    const bytes = Buffer.from(await file.arrayBuffer());
    const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isJpeg) return NextResponse.json({ error: "Please send a JPG photo." }, { status: 400 });

    const path = tenant.id + "/" + Date.now() + "-" + randomUUID().slice(0, 8) + ".jpg";
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (uploadError) return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });

    return NextResponse.json({ path });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to upload photo" }, { status: 500 });
  }
}
