import { describe, it, expect } from "vitest";
import { nairobiPeriod, nairobiDate } from "@/lib/period";

// The exact bug these guard against (see lib/period.ts's own comment):
// Vercel servers run in UTC, three hours behind Nairobi. Without converting
// to Nairobi time first, a payment made at 1am Nairobi time on the 1st of
// the month would be filed under the PREVIOUS month's invoice, because in
// UTC it's still 10pm the day before.
describe("nairobiPeriod", () => {
  it("returns the Nairobi month even when UTC is still the previous day", () => {
    // 2026-08-31 22:00 UTC = 2026-09-01 01:00 Nairobi (UTC+3)
    const d = new Date("2026-08-31T22:00:00Z");
    expect(nairobiPeriod(d)).toBe("September 2026");
  });

  it("returns the same month when well within Nairobi business hours", () => {
    // 2026-09-15 12:00 UTC = 2026-09-15 15:00 Nairobi
    const d = new Date("2026-09-15T12:00:00Z");
    expect(nairobiPeriod(d)).toBe("September 2026");
  });

  it("rolls over correctly at a year boundary", () => {
    // 2026-12-31 22:00 UTC = 2027-01-01 01:00 Nairobi
    const d = new Date("2026-12-31T22:00:00Z");
    expect(nairobiPeriod(d)).toBe("January 2027");
  });
});

describe("nairobiDate", () => {
  it("returns YYYY-MM-DD in Nairobi time, not UTC", () => {
    // 2026-08-31 22:00 UTC is already September 1st in Nairobi.
    const d = new Date("2026-08-31T22:00:00Z");
    expect(nairobiDate(d)).toBe("2026-09-01");
  });
});
