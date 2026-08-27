import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

const VALID_STATUSES = ["submitted", "under_review", "resolved"];

// Confirms this complaint belongs (via unit -> property) to the given landlord,
// the same pattern used for maintenance_requests - complaints has no direct
// landlord_id column, so ownership has to be checked through the join.
async function verifyOwnership(complaintId: string, landlordId: string) {
  const { data, error } = await supabaseAdmin
    .from("complaints")
    .select("id, unit_id, units!inner(property_id, properties!inner(landlord_id))")
    .eq("id", complaintId)
    .maybeSingle();
  if (error || !data) return false;
  const landlordOnRecord = (data as any).units?.properties?.landlord_id;
  return landlordOnRecord === landlordId;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { status } = body;
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const owns = await verifyOwnership(id, userData.user.id);
    if (!owns) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });

    const { error: updateError } = await supabaseAdmin.from("complaints").update({ status }).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update complaint" }, { status: 500 });
  }
}
