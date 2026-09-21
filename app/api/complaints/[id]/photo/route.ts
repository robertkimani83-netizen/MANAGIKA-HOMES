import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Gives the landlord a short-lived link to the photo on one of THEIR tenants'
// complaints. The photo bucket is private, so this is the only way to see it.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("complaints")
      .select("id, tenant_id, photo_path, units!inner(properties!inner(landlord_id))")
      .eq("id", id)
      .maybeSingle();
    // Same answer whether the complaint is missing or belongs to someone else.
    if (error || !data || (data as any).units?.properties?.landlord_id !== userData.user.id) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    const path = (data as any).photo_path as string | null;
    if (!path) return NextResponse.json({ error: "This complaint has no photo." }, { status: 404 });
    // The tenant's page writes photo_path itself, so only accept a file that
    // sits in that same tenant's own folder.
    if (!path.startsWith((data as any).tenant_id + "/") || path.includes("..")) {
      return NextResponse.json({ error: "This complaint has no photo." }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage.from("complaint-photos").createSignedUrl(path, 300);
    if (signError || !signed?.signedUrl) return NextResponse.json({ error: "The photo could not be opened." }, { status: 500 });

    return NextResponse.json({ url: signed.signedUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to open photo" }, { status: 500 });
  }
}
