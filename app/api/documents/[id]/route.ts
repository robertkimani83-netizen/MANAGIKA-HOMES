import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only the landlord who owns this document may delete it - tenants can
    // view their own documents but never delete them.
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, landlord_id, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (docError || !doc || doc.landlord_id !== userData.user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await supabaseAdmin.storage.from("documents").remove([doc.storage_path]);
    const { error: deleteError } = await supabaseAdmin.from("documents").delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete document" }, { status: 500 });
  }
}
