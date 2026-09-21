import { supabase } from "@/lib/supabase";
import { periodIndex } from "@/lib/arrears";

// A tenant's account statement: everything they were charged and everything
// they paid, oldest first, with the balance after each line. Read with the
// caller's own login, so a tenant only ever gets their own and a landlord
// only their own tenants' (database row-level rules).

export type StatementEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  kind: "charge" | "payment";
  period: string; // "September 2026"
  charged: number;
  paid: number;
  balance: number; // running balance after this line (positive = owes)
  rent: number;
  water: number;
  garbage: number;
  method: string | null;
  reference: string | null;
};

// The day a monthly charge is dated: the 1st of its billing period.
export function periodStartIso(period: string): string | null {
  const index = periodIndex(period);
  if (index === null) return null;
  const year = Math.floor(index / 12);
  const month = index % 12;
  return year + "-" + String(month + 1).padStart(2, "0") + "-01";
}

// A timestamp as a Kenya-time calendar day.
function nairobiDay(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}

type InvoiceRow = { id: string; billing_period: string; rent_amount: number | null; water_amount: number | null; garbage_amount: number | null; total_due: number | null; created_at: string | null };
type PaymentRow = { id: string; amount_paid: number | null; payment_method: string | null; transaction_reference: string | null; paid_at: string | null; invoices: { billing_period: string } | null };

export function buildStatement(invoices: InvoiceRow[], payments: PaymentRow[]): StatementEntry[] {
  const lines: Omit<StatementEntry, "balance">[] = [];

  for (const inv of invoices) {
    const total = Number(inv.total_due) || 0;
    if (total <= 0) continue;
    const date = periodStartIso(inv.billing_period) || (inv.created_at ? nairobiDay(inv.created_at) : "");
    lines.push({
      id: "inv-" + inv.id,
      date,
      kind: "charge",
      period: inv.billing_period,
      charged: total,
      paid: 0,
      rent: Number(inv.rent_amount) || 0,
      water: Number(inv.water_amount) || 0,
      garbage: Number(inv.garbage_amount) || 0,
      method: null,
      reference: null,
    });
  }

  for (const p of payments) {
    const amount = Number(p.amount_paid) || 0;
    if (amount <= 0) continue;
    lines.push({
      id: "pay-" + p.id,
      date: p.paid_at ? nairobiDay(p.paid_at) : "",
      kind: "payment",
      period: p.invoices?.billing_period || "",
      charged: 0,
      paid: amount,
      rent: 0,
      water: 0,
      garbage: 0,
      method: p.payment_method,
      reference: p.transaction_reference,
    });
  }

  // Oldest first; on the same day the charge comes before the payment.
  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === b.kind ? 0 : a.kind === "charge" ? -1 : 1));

  let balance = 0;
  return lines.map((line) => {
    balance += line.charged - line.paid;
    return { ...line, balance };
  });
}

export async function loadStatement(tenantId: string): Promise<{ entries: StatementEntry[]; error: string | null }> {
  const [invoiceResult, paymentResult] = await Promise.all([
    supabase.from("invoices").select("id, billing_period, rent_amount, water_amount, garbage_amount, total_due, created_at").eq("tenant_id", tenantId),
    supabase.from("payments").select("id, amount_paid, payment_method, transaction_reference, paid_at, invoices!inner(tenant_id, billing_period)").eq("invoices.tenant_id", tenantId),
  ]);
  if (invoiceResult.error) return { entries: [], error: invoiceResult.error.message };
  if (paymentResult.error) return { entries: [], error: paymentResult.error.message };
  return { entries: buildStatement((invoiceResult.data || []) as InvoiceRow[], (paymentResult.data || []) as unknown as PaymentRow[]), error: null };
}

// "12 Sep 2026" from a YYYY-MM-DD day.
export function statementDate(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}
