import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Units have no landlord_id column of their own - ownership only exists
// via property_id -> properties.landlord_id. Deleting a unit is
// destructive and irreversible, so this route verifies ownership with a
// real query before deleting, the same pattern as
// app/api/maintenance/[id]/route.ts - a client-side-only check here
// could be skipped by calling the Supabase client directly from the
// browser console.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const landlordId = userData.user.id;

    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .select("id, properties!inner(landlord_id)")
      .eq("id", id)
      .maybeSingle();

    if (unitError || !unit || (unit as any).properties?.landlord_id !== landlordId) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from("units").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete unit" }, { status: 500 });
  }
}
