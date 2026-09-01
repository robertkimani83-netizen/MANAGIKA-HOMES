import { timingSafeEqual } from "crypto";

// Constant-time comparison for secret tokens (cron secret, M-Pesa/
// subscription callback tokens). A plain `!==` comparison returns as soon
// as it hits the first mismatched character, which means a wrong guess
// that happens to share more of the correct secret's prefix takes
// marginally longer to reject than one that doesn't - in principle,
// enough repeated timing over the network could let an attacker recover
// the secret one character at a time. timingSafeEqual always takes the
// same amount of time regardless of where (or whether) the strings
// differ, closing that side channel. Used everywhere this app checks a
// caller-supplied secret against an environment variable.
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a same-length timingSafeEqual so a length mismatch
    // doesn't itself leak information by returning faster than a
    // same-length, wrong-content comparison would.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
