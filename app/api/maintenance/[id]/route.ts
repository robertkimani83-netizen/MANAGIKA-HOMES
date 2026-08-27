import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// A maintenance request has no landlord_id column of its own - ownership
// only exists via unit_id -> units.property_id -> properties.landlord_id.
// The Supabase JS client can't express that join as a filter on an
// update()/delete() call, so this route does the ownership check itself
// with a real query before touching anything - the same pattern already
// used in send-reminder and payment-settings, instead of trusting a
// client-side check that a browser console call could simply skip.
async function verifyOwnership(requestId: string, landlordId: string) {
  const { data, error } = await supabaseAdmin
    .from("maintenance_requests")
    .select("id, unit_id, units!inner(property_id, properties!inner(landlord_id))")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !data) return false;
  const properties = (data as any).units?.properties;
  return properties?.landlord_id === landlordId;
}

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const landlordId = await authenticate(request);
    if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owns = await verifyOwnership(id, landlordId);
    if (!owns) return NextResponse.json({ error: "Maintenance request not found" }, { status: 404 });

    const body = await request.json();
    const status = body.status;
    const allowedStatuses = ["submitted", "assigned", "in_progress", "completed"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("maintenance_requests").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update request" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const landlordId = await authenticate(request);
    if (!landlordId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const owns = await verifyOwnership(id, landlordId);
    if (!owns) return NextResponse.json({ error: "Maintenance request not found" }, { status: 404 });

    const { error } = await supabaseAdmin.from("maintenance_requests").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete request" }, { status: 500 });
  }
}
