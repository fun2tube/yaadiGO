import { describe, it, expect } from "vitest";
import {
  paymentSchedule,
  DEFAULT_PAYMENT_SCHEDULE,
  DEFAULT_CANCELLATION,
} from "@/lib/crm/quote-content";

/**
 * The money a customer is asked for, and when.
 *
 * These numbers go on a document the business has to honour, so they are worth
 * pinning. The defaults previously shipped were invented — 25/50/25 against a
 * real policy of a flat ₹5,000 advance — which would have quoted the wrong
 * deposit on every single booking.
 */
describe("paymentSchedule", () => {
  it("charges the advance per person, not as a share of the total", () => {
    const rows = paymentSchedule(120000, DEFAULT_PAYMENT_SCHEDULE, 4);
    expect(rows[0].amount).toBe(20000); // ₹5,000 × 4
  });

  it("scales the advance with group size", () => {
    expect(paymentSchedule(120000, DEFAULT_PAYMENT_SCHEDULE, 1)[0].amount).toBe(5000);
    expect(paymentSchedule(120000, DEFAULT_PAYMENT_SCHEDULE, 7)[0].amount).toBe(35000);
  });

  it("always sums back to the total", () => {
    for (const [total, heads] of [[120000, 4], [99999, 3], [20499, 1], [1, 2]]) {
      const rows = paymentSchedule(total, DEFAULT_PAYMENT_SCHEDULE, heads);
      const sum = rows.reduce((s, r) => s + r.amount, 0);
      // A schedule that adds up to ₹3 less than the invoice is the kind of
      // thing a customer notices and an accountant cannot reconcile.
      expect(sum).toBe(total);
    }
  });

  it("defaults to one traveller rather than zero", () => {
    expect(paymentSchedule(50000, DEFAULT_PAYMENT_SCHEDULE)[0].amount).toBe(5000);
  });
});

describe("DEFAULT_CANCELLATION", () => {
  it("states the real windows, not a generic ladder", () => {
    const text = JSON.stringify(DEFAULT_CANCELLATION);
    expect(text).toContain("30 days");
    expect(text).toContain("70%");
    expect(text).toContain("50%");
  });

  it("says the advance is not refundable, and that flights follow the airline", () => {
    const text = JSON.stringify(DEFAULT_CANCELLATION).toLowerCase();
    expect(text).toContain("advance");
    expect(text).toContain("airline");
  });
});

describe("the balance row and the advance (review 2026-10-14, F7)", () => {
  it("makes the last row a remainder with no percentage of its own", async () => {
    const { advanceFromSchedule } = await import("@/lib/crm/quote-content");
    const rows = paymentSchedule(64155, DEFAULT_PAYMENT_SCHEDULE, 2);
    expect(rows.map((r) => r.amount)).toEqual([10000, 32078, 22077]);
    expect(rows.at(-1).remainder).toBe(true);
    expect(rows.at(-1).percent).toBeUndefined();
    expect(advanceFromSchedule(64155, DEFAULT_PAYMENT_SCHEDULE, 2)).toBe(10000);
  });

  it("never asks an advance larger than the trip", async () => {
    const { advanceFromSchedule } = await import("@/lib/crm/quote-content");
    expect(advanceFromSchedule(4000, DEFAULT_PAYMENT_SCHEDULE, 2)).toBe(4000);
  });
});
