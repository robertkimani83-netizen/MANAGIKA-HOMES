// Billing periods are calendar months in KENYA time. Vercel servers run in
// UTC, which is three hours behind Nairobi, so for the first three hours of
// every month (00:00-03:00 Nairobi) plain `new Date().getMonth()` on the
// server still says the PREVIOUS month - a payment made at 1 a.m. on the 1st
// would land on last month's invoice, and a new invoice would be created for
// the wrong month. Always build periods with these helpers on the server.
//
// The format ("September 2026") must match currentPeriod() in the browser
// pages (which use the tenant's/landlord's own clock, i.e. Kenya time).

const TZ = "Africa/Nairobi";

// "September 2026"
export function nairobiPeriod(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "long" }).formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  return month + " " + year;
}

// "2026-09-21" (today's date in Nairobi)
export function nairobiDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// ---- Working with periods as numbers ------------------------------------
// Periods are stored as text ("September 2026"), so "is this month before
// that one" or "what was last month" needs them as a number first:
// year * 12 + monthIndex. Shared by payment allocation (pay off the oldest
// unpaid month first), the Payments page's previous-month list and the AI
// assistant's summary.

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "September 2026" -> 2026 * 12 + 8, or null when the text is not a period.
export function periodToIndex(period: string): number | null {
  const [month, year] = String(period || "").trim().split(/\s+/);
  const monthIndex = MONTH_NAMES.indexOf(month);
  const yearNumber = Number(year);
  if (monthIndex < 0 || !Number.isInteger(yearNumber)) return null;
  return yearNumber * 12 + monthIndex;
}

export function indexToPeriod(index: number): string {
  const year = Math.floor(index / 12);
  return MONTH_NAMES[index - year * 12] + " " + year;
}

// shiftPeriod("October 2026", -1) -> "September 2026". Returns the input
// unchanged if it isn't a valid period.
export function shiftPeriod(period: string, months: number): string {
  const index = periodToIndex(period);
  return index === null ? period : indexToPeriod(index + months);
}

// "2026-09-01" - the first day of a period, used as the due date when an
// invoice for a past month is created late (e.g. September rent recorded in
// October). Empty string for an invalid period.
export function periodStartDate(period: string): string {
  const index = periodToIndex(period);
  if (index === null) return "";
  const year = Math.floor(index / 12);
  return year + "-" + String(index - year * 12 + 1).padStart(2, "0") + "-01";
}
