import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Read-only summary for a caretaker/staff member - deliberately scoped
// to operational matters only (maintenance, complaints, announcements),
// NOT financial or tenant-identity data (no rent amounts, no who's paid,
// no tenant contact list). Access is proven by an active row in
// landlord_staff linking this signed-in user to a landlord, checked here
// with the service-role key rather than by adding staff branches to
// every existing RLS policy in the app.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("landlord_staff")
      .select("landlord_id, status")
      .eq("auth_user_id", userData.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: "You don't have active access to a landlord's portfolio." }, { status: 403 });
    }

    const landlordId = membership.landlord_id;

    const { data: maintenance } = await supabaseAdmin
      .from("maintenance_requests")
      .select("id, title, category, urgency, status, created_at, units!inner(unit_number, properties!inner(landlord_id))")
      .eq("units.properties.landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .limit(30);

    const { data: complaints } = await supabaseAdmin
      .from("complaints")
      .select("id, description, status, created_at, units!inner(unit_number, properties!inner(landlord_id))")
      .eq("units.properties.landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .limit(30);

    const { data: announcements } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, category, created_at")
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      maintenance: (maintenance || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        category: m.category,
        urgency: m.urgency,
        status: m.status,
        unitNumber: m.units?.unit_number || null,
        createdAt: m.created_at,
      })),
      complaints: (complaints || []).map((c: any) => ({
        id: c.id,
        description: c.description,
        status: c.status,
        unitNumber: c.units?.unit_number || null,
        createdAt: c.created_at,
      })),
      announcements: (announcements || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        createdAt: a.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load summary" }, { status: 500 });
  }
}
