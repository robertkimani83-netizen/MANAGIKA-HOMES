import { supabase } from "@/lib/supabase";
import { periodStartDate, shiftPeriod } from "@/lib/period";

// "Who didn't pay in full for <month>" - shared by the Payments page's
// previous-month list and the AI assistant, so both always agree.
//
// Read with the landlord's own login (RLS keeps it to their tenants). A
// tenant counts for the month if they have an invoice for it. An active
// tenant with NO invoice for the month is also listed as unpaid (no payment
// recorded) - many tenants were added to the app partway through September
// 2026 and never got a September invoice, but they still owed September.
// The only ones left out are tenants whose joined date or lease start is
// AFTER that month ended (they moved in later, so they owe nothing for it).

export type PeriodStatusRow = {
  tenantId: string;
  invoiceId: string | null;
  name: string;
  phone: string;
  unitId: string | null;
  unit: string;
  property: string;
  rent: number;
  due: number;
  paid: number;
  balance: number;
  status: "paid" | "partial" | "unpaid";
  lastPaidAt: string | null;
  noInvoice: boolean;
  movedOut: boolean;
};

export async function loadPeriodStatus(landlordId: string, period: string): Promise<{ rows: PeriodStatusRow[]; error: string | null }> {
  const [{ data: invoices, error: invError }, { data: tenants, error: tenantError }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, tenant_id, unit_id, total_due, tenants!inner(full_name, phone_number, status, landlord_id), units(unit_number, base_rent, properties(property_name))")
      .eq("tenants.landlord_id", landlordId)
      .eq("billing_period", period),
    supabase
      .from("tenants")
      .select("id, full_name, phone_number, joined_at, lease_start_date, unit_id, units(unit_number, base_rent, status, properties(property_name))")
      .eq("landlord_id", landlordId)
      .eq("status", "active"),
  ]);
  if (invError) return { rows: [], error: invError.message };
  if (tenantError) return { rows: [], error: tenantError.message };

  const invoiceRows = (invoices || []) as any[];
  const paid: Record<string, number> = {};
  const lastPaid: Record<string, string> = {};
  for (let start = 0; start < invoiceRows.length; start += 100) {
    const ids = invoiceRows.slice(start, start + 100).map((i) => i.id);
    const { data: payments, error } = await supabase.from("payments").select("invoice_id, amount_paid, paid_at").in("invoice_id", ids);
    if (error) return { rows: [], error: error.message };
    for (const p of (payments || []) as any[]) {
      paid[p.invoice_id] = (paid[p.invoice_id] || 0) + (Number(p.amount_paid) || 0);
      if (p.paid_at && (!lastPaid[p.invoice_id] || p.paid_at > lastPaid[p.invoice_id])) lastPaid[p.invoice_id] = p.paid_at;
    }
  }

  const rows: PeriodStatusRow[] = [];
  const tenantsWithInvoice = new Set<string>();
  for (const inv of invoiceRows) {
    tenantsWithInvoice.add(inv.tenant_id);
    const due = Number(inv.total_due) || 0;
    const p = paid[inv.id] || 0;
    const balance = Math.max(due - p, 0);
    rows.push({
      tenantId: inv.tenant_id,
      invoiceId: inv.id,
      name: inv.tenants?.full_name || "Unknown tenant",
      phone: inv.tenants?.phone_number || "",
      unitId: inv.unit_id || null,
      unit: inv.units?.unit_number || "",
      property: inv.units?.properties?.property_name || "",
      rent: Number(inv.units?.base_rent) || 0,
      due,
      paid: p,
      balance,
      status: due > 0 && balance === 0 ? "paid" : p > 0 ? "partial" : "unpaid",
      lastPaidAt: lastPaid[inv.id] || null,
      noInvoice: false,
      movedOut: inv.tenants?.status !== "active",
    });
  }

  const nextMonthStart = periodStartDate(shiftPeriod(period, 1));
  for (const t of (tenants || []) as any[]) {
    if (tenantsWithInvoice.has(t.id)) continue;
    const unit = t.units;
    if (!unit || unit.status !== "occupied") continue;
    const rent = Number(unit.base_rent) || 0;
    if (rent <= 0) continue;
    // Skip only tenants who clearly moved in after the month was over.
    const joined = t.joined_at ? String(t.joined_at).slice(0, 10) : "";
    const leaseStart = t.lease_start_date ? String(t.lease_start_date).slice(0, 10) : "";
    if (nextMonthStart && ((joined && joined >= nextMonthStart) || (leaseStart && leaseStart >= nextMonthStart))) continue;
    rows.push({
      tenantId: t.id,
      invoiceId: null,
      name: t.full_name || "Unknown tenant",
      phone: t.phone_number || "",
      unitId: t.unit_id || null,
      unit: unit.unit_number || "",
      property: unit.properties?.property_name || "",
      rent,
      due: rent,
      paid: 0,
      balance: rent,
      status: "unpaid",
      lastPaidAt: null,
      noInvoice: true,
      movedOut: false,
    });
  }

  return { rows, error: null };
}
