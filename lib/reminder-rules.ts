// A landlord's own rent rules, used to word reminders correctly.
//   dueDay     day of the month rent is due (1-28); the 5th when not set
//   penalties  whether paying late has penalties; yes when not set
// A landlord who never sets anything keeps exactly the wording used before
// these settings existed ("due by the 5th ... avoid penalties").

export const DEFAULT_DUE_DAY = 5;

export type ReminderRules = { dueDay: number; penalties: boolean };

// A whole number from 1 to 28 (every month has those days), else null.
export function cleanDueDay(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 28 ? n : null;
}

// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", 21 -> "21st".
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return n + "th";
  switch (n % 10) {
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

// Reads the two columns of a landlord_payment_settings row (or nothing).
export function toReminderRules(row: { reminder_due_day?: unknown; reminder_penalties?: unknown } | null | undefined): ReminderRules {
  return {
    dueDay: cleanDueDay(row?.reminder_due_day) ?? DEFAULT_DUE_DAY,
    penalties: row?.reminder_penalties === false ? false : true,
  };
}
