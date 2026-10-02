import { describe, it, expect } from "vitest";
import { allocateToEarlierMonths, pieceReference, allocationPeriodsText } from "@/lib/payment-allocation";
import { periodToIndex, shiftPeriod, periodStartDate } from "@/lib/period";

const inv = (id: string, billing_period: string, total_due: number, paid = 0) => ({ id, billing_period, total_due, paid });

describe("allocateToEarlierMonths", () => {
  it("puts a late September payment made in October on September", () => {
    const r = allocateToEarlierMonths(10000, [inv("sep", "September 2026", 10000), inv("oct", "October 2026", 10000)], "October 2026");
    expect(r.allocations).toEqual([{ invoiceId: "sep", period: "September 2026", amount: 10000 }]);
    expect(r.remainder).toBe(0);
  });

  it("clears a partial September balance first, then the rest goes to October", () => {
    const r = allocateToEarlierMonths(15000, [inv("sep", "September 2026", 10000, 5000)], "October 2026");
    expect(r.allocations).toEqual([{ invoiceId: "sep", period: "September 2026", amount: 5000 }]);
    expect(r.remainder).toBe(10000);
  });

  it("pays the oldest month first across a year boundary", () => {
    const r = allocateToEarlierMonths(12000, [inv("jan", "January 2027", 8000), inv("dec", "December 2026", 8000)], "February 2027");
    expect(r.allocations.map((a) => a.invoiceId)).toEqual(["dec", "jan"]);
    expect(r.allocations.map((a) => a.amount)).toEqual([8000, 4000]);
    expect(r.remainder).toBe(0);
  });

  it("leaves the whole amount for the current month when nothing earlier is owed", () => {
    const r = allocateToEarlierMonths(10000, [inv("oct", "October 2026", 10000)], "October 2026");
    expect(r.allocations).toEqual([]);
    expect(r.remainder).toBe(10000);
  });

  it("ignores invalid periods and already-settled invoices", () => {
    const r = allocateToEarlierMonths(5000, [inv("x", "garbage", 9000), inv("aug", "August 2026", 7000, 7000)], "October 2026");
    expect(r.allocations).toEqual([]);
    expect(r.remainder).toBe(5000);
  });
});

describe("split payment references", () => {
  it("keeps the real reference on the first piece so duplicate checks still work", () => {
    expect(pieceReference("UIK5N73NAW", 0)).toBe("UIK5N73NAW");
    expect(pieceReference("UIK5N73NAW", 1)).toBe("UIK5N73NAW-2");
    expect(pieceReference(null, 1)).toBeNull();
  });

  it("names every month once in the confirmation", () => {
    expect(allocationPeriodsText([
      { invoiceId: "a", period: "September 2026", amount: 1 },
      { invoiceId: "b", period: "October 2026", amount: 1 },
    ])).toBe("September 2026 & October 2026");
  });
});

describe("period helpers", () => {
  it("shifts across years and finds month starts", () => {
    expect(shiftPeriod("January 2027", -1)).toBe("December 2026");
    expect(shiftPeriod("October 2026", -1)).toBe("September 2026");
    expect(periodStartDate("September 2026")).toBe("2026-09-01");
    expect(periodToIndex("nonsense")).toBeNull();
  });
});

import { shouldCreateLastMonthInvoice } from "@/lib/payment-allocation";

describe("shouldCreateLastMonthInvoice", () => {
  it("creates September for a tenant added mid-September who has no September invoice", () => {
    expect(shouldCreateLastMonthInvoice(false, "2026-09-20", "October 2026", 4000)).toBe(true);
  });
  it("does not when the September invoice already exists", () => {
    expect(shouldCreateLastMonthInvoice(true, "2026-09-20", "October 2026", 4000)).toBe(false);
  });
  it("does not for a tenant who moved in this month", () => {
    expect(shouldCreateLastMonthInvoice(false, "2026-10-02", "October 2026", 4000)).toBe(false);
  });
  it("does not when the unit has no rent set", () => {
    expect(shouldCreateLastMonthInvoice(false, "2026-09-20", "October 2026", 0)).toBe(false);
  });
});
