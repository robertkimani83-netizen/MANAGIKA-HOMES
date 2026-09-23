import { describe, it, expect } from "vitest";
import { normalizePhone, phoneVariants, toLocalPhone } from "@/lib/tenant-phone";

// normalizePhone() is the single gate every phone number passes through
// before a WhatsApp template or SMS is sent (payment confirmations, rent
// reminders, admin alerts). Getting this wrong means messages silently
// go nowhere, or worse, get built against a malformed "phone number".
describe("normalizePhone", () => {
  it("accepts 07XXXXXXXX (the format landlords type most)", () => {
    expect(normalizePhone("0712345678")).toBe("+254712345678");
  });

  it("accepts 254XXXXXXXXX", () => {
    expect(normalizePhone("254712345678")).toBe("+254712345678");
  });

  it("accepts +254XXXXXXXXX unchanged in shape", () => {
    expect(normalizePhone("+254712345678")).toBe("+254712345678");
  });

  it("accepts bare 9-digit local numbers (7XXXXXXXX)", () => {
    expect(normalizePhone("712345678")).toBe("+254712345678");
  });

  it("strips spaces and punctuation before validating", () => {
    expect(normalizePhone("0712 345 678")).toBe("+254712345678");
    expect(normalizePhone("+254 712 345 678")).toBe("+254712345678");
  });

  it("rejects numbers that are the wrong length", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("07123456789")).toBeNull(); // one digit too many
  });

  it("rejects empty or garbage input instead of throwing", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("not a phone number")).toBeNull();
  });
});

describe("phoneVariants", () => {
  it("returns the E.164, digits-only, and local forms of the same number", () => {
    expect(phoneVariants("+254712345678")).toEqual(["+254712345678", "254712345678", "0712345678"]);
  });
});

describe("toLocalPhone", () => {
  it("converts any accepted format to 0-prefixed local form", () => {
    expect(toLocalPhone("+254712345678")).toBe("0712345678");
    expect(toLocalPhone("254712345678")).toBe("0712345678");
    expect(toLocalPhone("712345678")).toBe("0712345678");
  });

  it("is null for an unrecognisable number", () => {
    expect(toLocalPhone("abc")).toBeNull();
  });
});
