// Decides WHICH month's invoice a rent payment pays off, and records it.
//
// Before this file, every payment landed on the invoice for the month it
// arrived in. So a tenant who skipped September and paid in October had the
// money filed under October, and September stayed "unpaid" forever even
// though they had in fact caught up. Now:
//
// - "auto" (bank SMS webhook, and the default in the manual form): the
//   payment clears the OLDEST unpaid month first, then the next, and whatever
//   is left goes to the current month. A KSh 15,000 payment from a tenant who
//   owes KSh 5,000 for September and KSh 10,000 for October clears both.
// - a specific period (manual form, "Apply to: September 2026"): the whole
//   amount goes to that month's invoice, created if it doesn't exist yet.
//
// When one payment is split across months, each piece is its own payments
// row (payments.invoice_id is a single invoice). The FIRST piece keeps the
// real transaction reference, so the existing "have we seen this M-Pesa ref
// before" duplicate checks still catch a retried SMS; later pieces get
// "-2", "-3"... appended so they never clash with that unique reference.
// All pieces are inserted in ONE insert call, which the database applies as
// a single statement - either every piece is saved or none is.
//
// Works with either the admin client (server routes) or the landlord's own
// RLS-scoped client (the Payments page), so the same rules apply on every
// path that records rent.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceStatusFor } from "@/lib/invoice-math";
import { periodToIndex, periodStartDate } from "@/lib/period";

export type OpenInvoice = { id: string; billing_period: string; total_due: number; paid: number };
export type Allocation = { invoiceId: string; period: string; amount: number };

// Pure part, unit-tested in lib/__tests__/payment-allocation.test.ts.
// Pays off invoices from periods BEFORE currentPeriod, oldest first. Returns
// what went where, and how much is left over for the current month.
export function allocateToEarlierMonths(
  amount: number,
  openInvoices: OpenInvoice[],
  currentPeriod: string
): { allocations: Allocation[]; remainder: number } {
  const currentIndex = periodToIndex(currentPeriod);
  let remaining = Math.max(Number(amount) || 0, 0);
  const allocations: Allocation[] = [];
  if (currentIndex === null) return { allocations, remainder: remaining };

  const earlier = openInvoices
    .map((inv) => ({ inv, index: periodToIndex(inv.billing_period) }))
    .filter((x): x is { inv: OpenInvoice; index: number } => x.index !== null && x.index < currentIndex)
    .sort((a, b) => a.index - b.index);

  for (const { inv } of earlier) {
    if (remaining <= 0) break;
    const owed = Math.max((Number(inv.total_due) || 0) - (Number(inv.paid) || 0), 0);
    if (owed <= 0) continue;
    const piece = Math.min(owed, remaining);
    allocations.push({ invoiceId: inv.id, period: inv.billing_period, amount: piece });
    remaining -= piece;
  }
  return { allocations, remainder: remaining };
}

// Reference for the n-th piece (0-based) of a split payment.
export function pieceReference(reference: string | null, index: number): string | null {
  if (!reference) return null;
  return index === 0 ? reference : reference + "-" + (index + 1);
}

// Every invoice for this tenant that isn't fully paid, with what has been
// paid on each so far.
export async function loadOpenInvoices(db: SupabaseClient, tenantId: string): Promise<{ invoices: OpenInvoice[]; error: string | null }> {
  const { data, error } = await db
    .from("invoices")
    .select("id, billing_period, total_due")
    .eq("tenant_id", tenantId)
    .neq("status", "paid");
  if (error) return { invoices: [], error: error.message };
  const rows = (data || []) as { id: string; billing_period: string; total_due: number }[];
  if (rows.length === 0) return { invoices: [], error: null };

  const { data: payments, error: payError } = await db
    .from("payments")
    .select("invoice_id, amount_paid")
    .in("invoice_id", rows.map((r) => r.id));
  if (payError) return { invoices: [], error: payError.message };
  const paid: Record<string, number> = {};
  for (const p of (payments || []) as { invoice_id: string; amount_paid: number }[]) {
    paid[p.invoice_id] = (paid[p.invoice_id] || 0) + (Number(p.amount_paid) || 0);
  }
  return {
    invoices: rows.map((r) => ({ id: r.id, billing_period: r.billing_period, total_due: Number(r.total_due) || 0, paid: paid[r.id] || 0 })),
    error: null,
  };
}

// Total this tenant still owes across every unpaid month - used for the
// "Balance remaining" line in payment confirmations, so a tenant who paid
// September late hears what they still owe overall, not just on one invoice.
export async function tenantOutstanding(db: SupabaseClient, tenantId: string): Promise<number | null> {
  const { invoices, error } = await loadOpenInvoices(db, tenantId);
  if (error) return null;
  return invoices.reduce((sum, inv) => sum + Math.max(inv.total_due - inv.paid, 0), 0);
}

export type RecordRentPaymentInput = {
  tenantId: string;
  unitId: string | null;
  // Unit rent, used when an invoice for the month has to be created.
  rent: number;
  amount: number;
  method: string;
  reference: string | null;
  // The month it is now (Nairobi time on the server, landlord's clock in the browser).
  currentPeriod: string;
  // "auto" = oldest unpaid month first, or a period such as "September 2026".
  applyTo: "auto" | string;
  // Due date to use if the CURRENT month's invoice has to be created now.
  currentDueDate: string;
};

export type RecordRentPaymentResult =
  | { ok: true; allocations: Allocation[]; statusErrors: string[] }
  | { ok: false; error: string; code?: string };

export async function recordRentPayment(db: SupabaseClient, input: RecordRentPaymentInput): Promise<RecordRentPaymentResult> {
  const amount = Number(input.amount) || 0;
  if (amount <= 0) return { ok: false, error: "Amount must be more than zero" };

  let allocations: Allocation[] = [];
  let remainder = amount;
  let targetPeriod = input.currentPeriod;

  if (input.applyTo === "auto") {
    const { invoices, error } = await loadOpenInvoices(db, input.tenantId);
    if (error) return { ok: false, error: "Could not check earlier unpaid months: " + error };
    const result = allocateToEarlierMonths(amount, invoices, input.currentPeriod);
    allocations = result.allocations;
    remainder = result.remainder;
  } else {
    if (periodToIndex(input.applyTo) === null) return { ok: false, error: "Invalid month: " + input.applyTo };
    targetPeriod = input.applyTo;
  }

  if (remainder > 0) {
    const findInvoice = async () => {
      const { data } = await db
        .from("invoices")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("billing_period", targetPeriod)
        .maybeSingle();
      return (data as { id: string } | null) || null;
    };
    let invoice = await findInvoice();
    if (!invoice) {
      const rent = Number(input.rent) || 0;
      const total = rent > 0 ? rent : remainder;
      const dueDate = targetPeriod === input.currentPeriod ? input.currentDueDate : periodStartDate(targetPeriod);
      const { data: created } = await db
        .from("invoices")
        .insert({
          invoice_number: "INV-" + Date.now() + "-" + input.tenantId.slice(0, 6),
          tenant_id: input.tenantId,
          unit_id: input.unitId,
          billing_period: targetPeriod,
          rent_amount: total,
          total_due: total,
          status: "unpaid",
          due_date: dueDate,
        })
        .select("id")
        .single();
      // Another request (or the monthly cron) may have created it first.
      invoice = (created as { id: string } | null) || (await findInvoice());
    }
    if (!invoice) return { ok: false, error: "Could not find or create the invoice for " + targetPeriod };
    allocations.push({ invoiceId: invoice.id, period: targetPeriod, amount: remainder });
  }

  const rows = allocations.map((a, i) => ({
    invoice_id: a.invoiceId,
    amount_paid: a.amount,
    payment_method: input.method,
    transaction_reference: pieceReference(input.reference, i),
  }));
  const { error: insertError } = await db.from("payments").insert(rows);
  if (insertError) return { ok: false, error: insertError.message, code: (insertError as any).code };

  // Re-total each touched invoice and update its status.
  const statusErrors: string[] = [];
  for (const a of allocations) {
    const [{ data: inv }, { data: pays }] = await Promise.all([
      db.from("invoices").select("total_due").eq("id", a.invoiceId).maybeSingle(),
      db.from("payments").select("amount_paid").eq("invoice_id", a.invoiceId),
    ]);
    const totalPaid = ((pays || []) as { amount_paid: number }[]).reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);
    const status = invoiceStatusFor(Number((inv as any)?.total_due) || 0, totalPaid);
    const { error } = await db.from("invoices").update({ status }).eq("id", a.invoiceId);
    if (error) statusErrors.push(a.period + ": " + error.message);
  }

  return { ok: true, allocations, statusErrors };
}

// "September 2026" or "September 2026 & October 2026" for confirmation messages.
export function allocationPeriodsText(allocations: Allocation[]): string {
  return Array.from(new Set(allocations.map((a) => a.period))).join(" & ");
}
