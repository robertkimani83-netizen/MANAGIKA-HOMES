// The core "how much is still owed, and what does that make the invoice
// status" math, used every time a payment is recorded: the M-Pesa callback,
// the bank SMS webhook, manual payment entry, water-bill payments, and
// tenant payment-claim approval. Before this file existed the same
// paid-vs-due comparison was copy-pasted into all five places - if one got
// fixed (e.g. a rounding edge case) and another didn't, invoices could show
// different statuses for the same math depending on which screen recorded
// the payment. Written once here, and covered by lib/__tests__/invoice-math.test.ts,
// so a change to this logic is verified everywhere it's used, in one place.

export type InvoiceStatus = "unpaid" | "partially_paid" | "paid";

// Kept in the historical order (paid checked before partially_paid) that
// every call site already used, including the "totalDue > 0" guard some of
// them had and some didn't - an invoice with total_due of 0 is never
// reported "paid" just because 0 >= 0.
export function invoiceStatusFor(totalDue: number, totalPaid: number): InvoiceStatus {
  const due = Number(totalDue) || 0;
  const paid = Number(totalPaid) || 0;
  if (due > 0 && paid >= due) return "paid";
  if (paid > 0) return "partially_paid";
  return "unpaid";
}

// What's still owed. Never negative - a tenant who overpays (or a
// double-counted payment) must never show a negative balance anywhere in
// the app.
export function remainingBalance(totalDue: number, totalPaid: number): number {
  return Math.max((Number(totalDue) || 0) - (Number(totalPaid) || 0), 0);
}

// Percentage of what was due that has actually come in, rounded to a whole
// number for display (the dashboard's monthly trend chart). null when
// nothing was due, rather than a misleading 0/0 -> "0%". Capped at 100 so an
// overpaid period never shows something like "140% collected".
export function collectionRate(totalDue: number, totalCollected: number): number | null {
  const due = Number(totalDue) || 0;
  if (due <= 0) return null;
  return Math.min(100, Math.round((Number(totalCollected) / due) * 100));
}
