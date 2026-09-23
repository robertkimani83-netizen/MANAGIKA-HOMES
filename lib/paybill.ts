// Paybill payment instructions shown to tenants ("Paybill 222111, Account
// 27833#A14"). Pure helpers with no server imports, so the landlord dashboard
// (browser) and the reminder routes (server) build the account the same way.

export type PaybillInfo = { paybill: string; accountPrefix: string };

// A Paybill number is 5 to 7 digits. Anything else is treated as "not set" so
// a typo can never end up in a message tenants will act on.
export function cleanPaybill(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 5 && digits.length <= 7 ? digits : "";
}

// The fixed part of the account (before the "#"). Letters and digits only, no
// spaces and no "#", so "27 833", "27833#" and "27833" all become "27833".
export function cleanAccountPrefix(value: unknown): string {
  return String(value ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
}

// The unit part of the account: "A 14" and "#A14" both become "A14".
function cleanUnit(unitNumber: unknown): string {
  return String(unitNumber ?? "").replace(/[\s#]/g, "");
}

// "27833" + unit "A14" -> "27833#A14". With no fixed part the account is just
// the unit; with no unit it is just the fixed part.
export function paybillAccount(info: PaybillInfo, unitNumber: unknown): string {
  const unit = cleanUnit(unitNumber);
  if (info.accountPrefix && unit) return info.accountPrefix + "#" + unit;
  return unit || info.accountPrefix;
}

// Turns a landlord_payment_settings row into PaybillInfo, or null when the
// landlord has not set a valid Paybill.
export function toPaybillInfo(row: { paybill_number?: unknown; paybill_account?: unknown } | null | undefined): PaybillInfo | null {
  const paybill = cleanPaybill(row?.paybill_number);
  if (!paybill) return null;
  return { paybill, accountPrefix: cleanAccountPrefix(row?.paybill_account) };
}

// One line of payment instructions for free-text messages (WhatsApp links).
export function paybillLine(info: PaybillInfo, unitNumber: unknown): string {
  return "Pay via M-Pesa Paybill " + info.paybill + ", Account " + paybillAccount(info, unitNumber) + ".";
}
