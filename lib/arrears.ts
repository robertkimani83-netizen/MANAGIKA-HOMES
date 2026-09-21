import { supabase } from "@/lib/supabase";

// "Who is how late with the rent". Billing periods are stored as text such as
// "September 2026", so lateness is counted in whole calendar months between
// that period and this month: this month = 0, last month = 1, and so on.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type ArrearsBucketKey = "current" | "one" | "two" | "three";

export const ARREARS_BUCKETS: { key: ArrearsBucketKey; label: string; tone: string }[] = [
  { key: "current", label: "This month", tone: "amber" },
  { key: "one", label: "1 month late", tone: "orange" },
  { key: "two", label: "2 months late", tone: "rose" },
  { key: "three", label: "3+ months late", tone: "red" },
];

export type ArrearsRow = {
  tenantId: string;
  name: string;
  phone: string;
  property: string;
  unit: string;
  balance: number;
  oldestPeriod: string;
  monthsLate: number;
  bucket: ArrearsBucketKey;
  unpaidInvoices: number;
};

// "September 2026" -> 2026 * 12 + 8, or null when the text is not a period.
export function periodIndex(period: string): number | null {
  const [month, year] = String(period || "").trim().split(/\s+/);
  const monthIndex = MONTHS.indexOf(month);
  const yearNumber = Number(year);
  if (monthIndex < 0 || !Number.isFinite(yearNumber)) return null;
  return yearNumber * 12 + monthIndex;
}

export function monthsLate(period: string, now: Date = new Date()): number {
  const index = periodIndex(period);
  if (index === null) return 0;
  return Math.max(0, now.getFullYear() * 12 + now.getMonth() - index);
}

export function bucketFor(months: number): ArrearsBucketKey {
  if (months <= 0) return "current";
  if (months === 1) return "one";
  if (months === 2) return "two";
  return "three";
}

// Everything is read with the landlord's own login, so the database's own
// row-level rules keep it to this landlord's tenants. Only current (active)
// tenants are counted, the same as the dashboard's Outstanding figure.
export async function loadArrears(landlordId: string): Promise<{ rows: ArrearsRow[]; error: string | null }> {
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, tenant_id, total_due, billing_period, tenants!inner(full_name, phone_number, status, landlord_id), units(unit_number, properties(property_name))")
    .eq("tenants.landlord_id", landlordId)
    .neq("status", "paid");
  if (error) return { rows: [], error: error.message };

  const unpaid = ((invoices || []) as any[]).filter((inv) => inv.tenants?.status === "active");
  if (unpaid.length === 0) return { rows: [], error: null };

  // Payments in batches, so a long list of invoice ids never makes one
  // request too long to send.
  const paidByInvoice: Record<string, number> = {};
  for (let start = 0; start < unpaid.length; start += 100) {
    const ids = unpaid.slice(start, start + 100).map((inv) => inv.id);
    const { data: payments, error: paymentsError } = await supabase.from("payments").select("invoice_id, amount_paid").in("invoice_id", ids);
    if (paymentsError) return { rows: [], error: paymentsError.message };
    for (const p of payments || []) {
      paidByInvoice[p.invoice_id] = (paidByInvoice[p.invoice_id] || 0) + (Number(p.amount_paid) || 0);
    }
  }

  const now = new Date();
  const byTenant: Record<string, ArrearsRow> = {};
  for (const inv of unpaid) {
    const owed = (Number(inv.total_due) || 0) - (paidByInvoice[inv.id] || 0);
    if (owed <= 0) continue;
    const late = monthsLate(inv.billing_period, now);
    const existing = byTenant[inv.tenant_id];
    if (!existing) {
      byTenant[inv.tenant_id] = {
        tenantId: inv.tenant_id,
        name: inv.tenants?.full_name || "Unknown tenant",
        phone: inv.tenants?.phone_number || "",
        property: inv.units?.properties?.property_name || "",
        unit: inv.units?.unit_number || "",
        balance: owed,
        oldestPeriod: inv.billing_period,
        monthsLate: late,
        bucket: bucketFor(late),
        unpaidInvoices: 1,
      };
    } else {
      existing.balance += owed;
      existing.unpaidInvoices += 1;
      if (late > existing.monthsLate) {
        existing.monthsLate = late;
        existing.oldestPeriod = inv.billing_period;
        existing.bucket = bucketFor(late);
      }
    }
  }

  const rows = Object.values(byTenant).sort((a, b) => b.monthsLate - a.monthsLate || b.balance - a.balance);
  return { rows, error: null };
}

export function summarize(rows: ArrearsRow[]) {
  const summary = {} as Record<ArrearsBucketKey, { count: number; amount: number }>;
  for (const bucket of ARREARS_BUCKETS) summary[bucket.key] = { count: 0, amount: 0 };
  for (const row of rows) {
    summary[row.bucket].count += 1;
    summary[row.bucket].amount += row.balance;
  }
  return summary;
}
