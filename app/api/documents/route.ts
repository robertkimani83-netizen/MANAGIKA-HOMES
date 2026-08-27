import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const VALID_TYPES = ["lease", "receipt", "deposit", "inspection", "notice", "other"];
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB - generous for a scanned lease/photo, small enough to keep uploads fast on a mobile connection

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Every document belongs to exactly one tenant/landlord pair. Files never
// go through the browser's anon-key Supabase client directly - the
// "documents" bucket is private with no client-facing storage policies,
// so this route (using the service-role key) is the only way in or out.
function storagePath(landlordId: string, tenantId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `${landlordId}/${tenantId}/${Date.now()}-${safeName}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    const tenantId = formData.get("tenantId");
    const documentType = formData.get("documentType");

    if (!(file instanceof File) || typeof tenantId !== "string" || !tenantId) {
      return NextResponse.json({ error: "Missing file or tenantId" }, { status: 400 });
    }
    const type = typeof documentType === "string" && VALID_TYPES.includes(documentType) ? documentType : "other";
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File is too large (15MB limit)" }, { status: 400 });
    }

    // Only a landlord who owns this tenant may upload a document for them.
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, landlord_id, unit_id")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantError || !tenant || tenant.landlord_id !== user.id) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const path = storagePath(user.id, tenantId, file.name || "document");
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage.from("documents").upload(path, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("documents")
      .insert({
        landlord_id: user.id,
        tenant_id: tenantId,
        unit_id: tenant.unit_id,
        document_type: type,
        file_name: file.name || "document",
        storage_path: path,
      })
      .select("id, document_type, file_name, uploaded_at")
      .single();
    if (insertError) {
      // Roll back the uploaded file so a failed insert doesn't leave an orphaned object in storage.
      await supabaseAdmin.storage.from("documents").remove([path]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ document: inserted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to upload document" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantIdParam = request.nextUrl.searchParams.get("tenantId");

    if (tenantIdParam) {
      // Landlord view: documents for one of their own tenants.
      const { data: tenant } = await supabaseAdmin.from("tenants").select("id, landlord_id").eq("id", tenantIdParam).maybeSingle();
      if (!tenant || tenant.landlord_id !== user.id) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }
      const { data, error } = await supabaseAdmin
        .from("documents")
        .select("id, document_type, file_name, uploaded_at")
        .eq("tenant_id", tenantIdParam)
        .order("uploaded_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ documents: data });
    }

    // Tenant view: their own documents, identified by the authenticated email.
    const { data: tenantRow } = await supabaseAdmin.from("tenants").select("id").eq("email", user.email).maybeSingle();
    if (!tenantRow) return NextResponse.json({ documents: [] });

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, document_type, file_name, uploaded_at")
      .eq("tenant_id", tenantRow.id)
      .order("uploaded_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ documents: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load documents" }, { status: 500 });
  }
}
