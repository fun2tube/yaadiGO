/**
 * Money.
 *
 * One rule: rupees exist at the edges — a form field, a PDF, a screen —
 * and paise exist everywhere else. Every value that crosses into the domain
 * or the database is an integer number of paise held in a bigint.
 *
 * This is not fussiness. `0.1 + 0.2 === 0.30000000000000004`, and the same
 * class of error on a ₹2,40,000 booking split across four travellers and a
 * 5% tax produces a total that is off by rupees — which the customer notices,
 * the accountant cannot reconcile, and nobody can reproduce.
 *
 * The functions are deliberately total: a bad input returns 0n rather than
 * NaN, because NaN propagates silently through a sum and poisons a report,
 * whereas a zero is visible on the screen the moment it is wrong.
 */

export type Paise = bigint;

/** Rupees (from a form, a price list, an API) → paise. Rounds to the nearest paisa. */
export function toPaise(rupees: number | string | null | undefined): Paise {
  if (rupees === null || rupees === undefined || rupees === "") return 0n;
  const n = typeof rupees === "string" ? Number(rupees) : rupees;
  if (!Number.isFinite(n)) return 0n;
  // Math.round before BigInt: BigInt() throws on a fractional number, and the
  // rounding has to happen in one place or it happens in five.
  return BigInt(Math.round(n * 100));
}

/** Paise → rupees as a number. For display and for JSON that leaves the server. */
export function toRupees(paise: Paise | number | null | undefined): number {
  if (paise === null || paise === undefined) return 0;
  const n = typeof paise === "bigint" ? Number(paise) : paise;
  return n / 100;
}

/**
 * Indian-format currency string.
 *
 * en-IN grouping (1,20,000 not 120,000) because this is what an Indian
 * customer reads as correct; Western grouping on an Indian invoice looks like
 * a mistake before anyone has checked the number.
 */
export function formatINR(paise: Paise | number | null | undefined): string {
  return `₹${toRupees(paise).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Sum, safely. */
export function sumPaise(values: Array<Paise | null | undefined>): Paise {
  return values.reduce<Paise>((total, value) => total + (value ?? 0n), 0n);
}

/**
 * Percentage of an amount, rounded to the nearest paisa.
 *
 * Kept in bigint the whole way — converting to a float to multiply by 0.05 is
 * exactly the bug this module exists to prevent. `+ 50n` before dividing by
 * 100n is round-half-up; bigint division truncates on its own.
 */
export function percentOf(amount: Paise, percent: number): Paise {
  const basis = BigInt(Math.round(percent * 100)); // percent → basis points
  return (amount * basis + 5000n) / 10000n;
}

/**
 * Split an amount across n people without losing or inventing a paisa.
 *
 * Dividing ₹1,000 three ways gives 33333, 33333, 33334 — the remainder is
 * distributed rather than dropped, so the parts always sum back to the whole.
 * A per-person figure that does not multiply back to the total is the sort of
 * discrepancy that surfaces in front of a customer.
 */
export function splitPaise(amount: Paise, parts: number): Paise[] {
  if (parts < 1) return [];
  const n = BigInt(parts);
  const base = amount / n;
  const remainder = amount - base * n;
  return Array.from({ length: parts }, (_, i) => base + (BigInt(i) < remainder ? 1n : 0n));
}

/** Guard for values arriving from JSON, where bigint does not survive. */
export function parsePaise(value: unknown): Paise {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

/**
 * bigint has no JSON representation, so anything crossing the wire is sent as
 * a string and the rupee value alongside it. The client renders `display`; the
 * string is there so a round trip never loses precision.
 */
export function serialisePaise(paise: Paise | null | undefined) {
  const value = paise ?? 0n;
  return { paise: value.toString(), rupees: toRupees(value), display: formatINR(value) };
}
