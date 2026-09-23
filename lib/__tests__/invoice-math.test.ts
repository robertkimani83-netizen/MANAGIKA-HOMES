import { describe, it, expect } from "vitest";
import { invoiceStatusFor, remainingBalance, collectionRate } from "@/lib/invoice-math";

// This is the exact "is the invoice paid, partial, or unpaid" decision used
// by every place a payment gets recorded (M-Pesa callback, bank SMS
// webhook, manual entry, water-bill payments, payment-claim approval). It
// used to be copy-pasted five times - these tests exist so a future edit to
// one call site can't quietly diverge from the other four again.
describe("invoiceStatusFor", () => {
  it("is unpaid when nothing has been paid", () => {
    expect(invoiceStatusFor(10000, 0)).toBe("unpaid");
  });

  it("is partially_paid when something, but not enough, has been paid", () => {
    expect(invoiceStatusFor(10000, 4000)).toBe("partially_paid");
  });

  it("is paid when the full amount has been paid", () => {
    expect(invoiceStatusFor(10000, 10000)).toBe("paid");
  });

  it("is paid when overpaid", () => {
    expect(invoiceStatusFor(10000, 12000)).toBe("paid");
  });

  it("is unpaid (never 'paid') when total_due is 0, even though 0 >= 0", () => {
    // Real bug shape this guards against: an invoice that has no rent set
    // yet (total_due = 0) must not immediately read as "paid".
    expect(invoiceStatusFor(0, 0)).toBe("unpaid");
  });

  it("treats missing/undefined amounts as 0 rather than throwing", () => {
    expect(invoiceStatusFor(undefined as any, undefined as any)).toBe("unpaid");
  });

  it("is partially_paid (not unpaid) when something was paid against an unknown/zero due amount", () => {
    // Matches the original inline logic every call site used: a real
    // payment against a not-yet-set total_due still counts as partial,
    // not unpaid - it's only "paid" that requires a known, positive due.
    expect(invoiceStatusFor(null as any, 500)).toBe("partially_paid");
  });
});

describe("remainingBalance", () => {
  it("subtracts what's paid from what's due", () => {
    expect(remainingBalance(10000, 4000)).toBe(6000);
  });

  it("never goes negative when overpaid", () => {
    expect(remainingBalance(10000, 15000)).toBe(0);
  });

  it("is the full amount when nothing has been paid", () => {
    expect(remainingBalance(10000, 0)).toBe(10000);
  });
});

describe("collectionRate", () => {
  it("computes a whole-number percentage", () => {
    expect(collectionRate(10000, 4000)).toBe(40);
  });

  it("rounds to the nearest whole number", () => {
    expect(collectionRate(3, 1)).toBe(33); // 33.33... -> 33
  });

  it("is null when nothing was due (not a misleading 0%)", () => {
    expect(collectionRate(0, 0)).toBeNull();
  });

  it("caps at 100 for an overpaid period", () => {
    expect(collectionRate(10000, 15000)).toBe(100);
  });
});
