import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes - long enough to open/download, short enough that a leaked link goes stale fast

// Returns a short-lived signed URL for one document's file. The
// "documents" bucket is private with no client-facing storage policies, so
// this is the only way to actually view/download a file - and it checks
// that the caller is EITHER the landlord who owns it OR the tenant it
// belongs to before ever calling Storage.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, landlord_id, tenant_id, storage_path, file_name")
      .eq("id", id)
      .maybeSingle();
    if (docError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const isOwnerLandlord = doc.landlord_id === userData.user.id;
    let isOwnerTenant = false;
    if (!isOwnerLandlord && userData.user.email) {
      const { data: tenant } = await supabaseAdmin.from("tenants").select("id").eq("id", doc.tenant_id).eq("email", userData.user.email).maybeSingle();
      isOwnerTenant = !!tenant;
    }
    if (!isOwnerLandlord && !isOwnerTenant) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signError || !signed) {
      return NextResponse.json({ error: signError?.message || "Could not create link" }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl, fileName: doc.file_name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create link" }, { status: 500 });
  }
}
