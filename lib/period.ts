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
