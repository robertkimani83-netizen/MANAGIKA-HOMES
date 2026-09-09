import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Public status check for the homepage's "pay first, then create your
// account" flow — polled from the browser before any session/landlord
// exists, so it deliberately returns nothing but the bare status string
// (never the phone number, amount, or anything else) since this route
// has no auth check of its own to gate on.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const invoiceId = (searchParams.get("invoice_id") || "").trim();
  if (!invoiceId) {
    return NextResponse.json({ status: "unknown" });
  }

  const { data } = await supabaseAdmin
    .from("subscription_stk_requests")
    .select("status")
    .eq("checkout_request_id", invoiceId)
    .maybeSingle();

  return NextResponse.json({ status: data?.status || "unknown" });
}
