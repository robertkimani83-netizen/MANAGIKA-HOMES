import { paybillAccount, type PaybillInfo } from "@/lib/paybill";
import { DEFAULT_DUE_DAY, ordinal } from "@/lib/reminder-rules";

// One readable SMS per tenant. A single SMS holds 160 characters; anything
// longer is split into several parts and each part is charged. So this builds
// the friendliest wording that fits in one SMS and, when a long name or unit
// number would push it over, drops the least important words first. The
// Paybill number and account are never cut: a tenant who cannot see them
// cannot pay.
//
//   period given  -> "your September rent of KSh 5,000 for Unit A14 is due by the 5th"
//                    (the day is the landlord's own due day; the 5th if not set)
//   period absent -> "your rent balance of KSh 5,000 for Unit A14 is due"
//                    (used for a manual reminder, where the amount can cover
//                    more than one month)

const LINK = "managikahomes.co.ke/tenant/login";
const MAX = 160;

export type ReminderSmsInput = {
  fullName: string;
  balance: number;
  unitNumber: string;
  period?: string;
  paybill?: PaybillInfo | null;
  dueDay?: number; // the landlord's due day of the month; the 5th when not given
  penalties?: boolean; // whether late payment has penalties; yes when not given
};

export function buildReminderSms(input: ReminderSmsInput): string {
  const first = (input.fullName || "").trim().split(/\s+/)[0] || "there";
  const name = first.length > 14 ? first.slice(0, 14) : first;
  const amount = "KSh " + Math.round(input.balance).toLocaleString("en-US");
  const unit = "Unit " + input.unitNumber;
  const month = input.period ? input.period.split(" ")[0] : "";
  const by = "the " + ordinal(input.dueDay || DEFAULT_DUE_DAY);

  const owed = month
    ? "your " + month + " rent of " + amount + " for " + unit + " is due by " + by
    : "your rent balance of " + amount + " for " + unit + " is due";
  const shortOwed = month
    ? amount + " rent for " + unit + " is due by " + by
    : amount + " rent balance for " + unit + " is due";

  if (input.paybill) {
    const acc = paybillAccount(input.paybill, input.unitNumber);
    const pay = "Paybill " + input.paybill.paybill + ", Account " + acc;
    const candidates = [
      "Hello " + name + ", " + owed + ". " + pay + ". Details: " + LINK,
      "Hello " + name + ", " + owed + ". Pay via M-Pesa " + pay + ".",
      "Hello " + name + ", " + owed + ". " + pay + ".",
      "Hi " + name + ", " + shortOwed + ". " + pay + ".",
      shortOwed.charAt(0).toUpperCase() + shortOwed.slice(1) + ". " + pay + ".",
    ];
    // Nothing fits (an extremely long unit number): send the shortest
    // complete version in two parts rather than cut the payment details.
    return candidates.find((c) => c.length <= MAX) || candidates[candidates.length - 1];
  }

  const payOnTime = input.penalties === false ? "Please pay on time." : "Please pay on time to avoid penalties.";
  const candidates = month
    ? [
        "Hello " + name + ", " + owed + ". " + payOnTime + " Details: " + LINK,
        "Hello " + name + ", " + owed + ". Details: " + LINK,
      ]
    : [
        "Hello " + name + ", " + owed + ". Please pay at your earliest convenience. Details: " + LINK,
        "Hello " + name + ", " + owed + ". Details: " + LINK,
      ];
  const fit = candidates.find((c) => c.length <= MAX);
  if (fit) return fit;
  return ("Hi " + name + ", " + shortOwed + ". Pay: " + LINK).slice(0, MAX);
}
