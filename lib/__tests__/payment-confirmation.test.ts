import { describe, it, expect } from "vitest";
import { paymentBalanceText } from "@/lib/payment-confirmation";

// This is the line every tenant reads at the end of their payment
// confirmation (WhatsApp and SMS) telling them whether they're square or
// still owe something - getting it wrong means a tenant either thinks
// they've overpaid when they haven't, or keeps paying after they're done.
describe("paymentBalanceText", () => {
  it("says fully paid once total paid reaches total due", () => {
    expect(paymentBalanceText(10000, 10000)).toBe("Your rent is now fully paid.");
  });

  it("says fully paid when overpaid", () => {
    expect(paymentBalanceText(10000, 12000)).toBe("Your rent is now fully paid.");
  });

  it("reports the remaining balance when underpaid", () => {
    expect(paymentBalanceText(10000, 4000)).toBe("Balance remaining: KSh 6,000.");
  });

  it("formats the remaining balance with thousands separators", () => {
    expect(paymentBalanceText(150000, 25000)).toBe("Balance remaining: KSh 125,000.");
  });
});
