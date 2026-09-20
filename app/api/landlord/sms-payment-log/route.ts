import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

// Read/resolve access to sms_payment_log (bank SMS the webhook could not
// match to a tenant). The table has no client-facing RLS policies on purpose,
// so it is only reachable through this route, and only by the ONE landlord
// account the SMS webhook collects for (SMS_WEBHOOK_LANDLORD_ID) - the log has
// no landlord column, so any other account gets a 404 and never sees it.
async function authorize(request: Request) {
  const allowedLandlordId = (process.env.SMS_WEBHOOK_LANDLORD_ID || "").trim();
  if (!allowedLandlordId) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (data.user.id !== allowedLandlordId) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { userId: data.user.id };
}

// GET /api/landlord/sms-payment-log - newest first, unresolved only unless
// ?all=1. Filters "resolved" in code (rather than in the query) so the page
// also works before the resolved-column migration has been run.
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const includeResolved = searchParams.get("all") === "1";

  const { data, error } = await supabaseAdmin
    .from("sms_payment_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (data || [])
    .filter((row: any) => includeResolved || row.resolved !== true)
    .map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      reason: row.reason,
      amount: row.amount,
      house_tag: row.house_tag,
      payer_name: row.payer_name,
      mpesa_ref: row.mpesa_ref,
      message_text: row.message_text,
      resolved: row.resolved === true,
    }));

  return NextResponse.json({ entries });
}

// POST /api/landlord/sms-payment-log { id, resolved } - mark handled / undo.
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const id = (body.id || "").toString();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const resolved = body.resolved !== false;

  const { error } = await supabaseAdmin
    .from("sms_payment_log")
    .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
