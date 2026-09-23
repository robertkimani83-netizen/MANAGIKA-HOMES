// Shared by every server route that needs to recognize a tenant's phone
// number: signup-phone, link-phone, tenant-payment-info, documents. Keep the
// login screen's client-side copy (app/tenant/login/page.tsx) in sync with
// normalizePhone() if this logic ever changes.

// Normalizes a Kenyan phone number to E.164 (+254XXXXXXXXX).
// Accepts the formats landlords actually enter: 07XXXXXXXX, 254XXXXXXXXX,
// +254XXXXXXXXX, 7XXXXXXXX.
export function normalizePhone(input: string): string | null {
  const trimmed = (input || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("254")) {
    return "+" + digits;
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    return "+254" + digits.slice(1);
  }
  if (digits.length === 9) {
    return "+254" + digits;
  }
  return null;
}

// The tenants table has phone numbers saved in whatever format the landlord
// typed or bulk-imported them in (07XXXXXXXX, 254XXXXXXXXX, ...). Build
// every representation of a given E.164 number so lookups can match any of
// them without needing a database migration to normalize existing data.
export function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, ""); // 254XXXXXXXXX
  const local = "0" + digits.slice(3); // 0XXXXXXXXX
  return [e164, digits, local];
}

// Local Kenyan format (0712345678 or 0110123456) from any accepted input, or
// null if it is not a recognisable Kenyan number. This is the form stored for
// tenants, because phoneVariants() above always includes it.
export function toLocalPhone(input: string): string | null {
  const e164 = normalizePhone(input);
  return e164 ? "0" + e164.slice(4) : null;
}

// True when two phone numbers, written in any format, are the same number.
export function samePhone(a: string, b: string): boolean {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  return !!x && !!y && x === y;
}
