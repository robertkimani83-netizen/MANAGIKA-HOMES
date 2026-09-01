import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const supabaseAuth = createClient(supabaseUrl, anonKey);

function csvCell(value: any) {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// A plain payment ledger export - not real double-entry accounting, and
// not connected to KRA eTIMS (that needs a finished business registration
// and real KRA API credentials, neither of which exist yet). This is the
// lightweight stand-in: every payment this landlord has recorded, in one
// CSV they can hand to an accountant or import into QuickBooks/Excel
// themselves, the same bridge Nyumba Zetu offers via its QuickBooks
// export.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const landlordId = userData.user.id;

    const { data: payments, error } = await supabaseAdmin
      .from("payments")
      .select(
        "paid_at, amount_paid, payment_method, transaction_reference, invoices!inner(billing_period, total_due, status, tenants!inner(full_name, landlord_id), units(unit_number, properties(property_name)))"
      )
      .eq("invoices.tenants.landlord_id", landlordId)
      .order("paid_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const header = ["Date Paid", "Tenant", "Property", "Unit", "Billing Period", "Amount Paid (KSh)", "Payment Method", "Reference", "Invoice Total Due (KSh)", "Invoice Status"];
    const rows = (payments || []).map((p: any) => [
      p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : "",
      p.invoices?.tenants?.full_name || "",
      p.invoices?.units?.properties?.property_name || "",
      p.invoices?.units?.unit_number || "",
      p.invoices?.billing_period || "",
      p.amount_paid,
      p.payment_method,
      p.transaction_reference || "",
      p.invoices?.total_due ?? "",
      p.invoices?.status || "",
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const fileName = "managika-ledger-" + new Date().toISOString().slice(0, 10) + ".csv";

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + fileName + '"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to export ledger" }, { status: 500 });
  }
}
