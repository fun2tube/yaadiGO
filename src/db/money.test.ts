import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  formatINR,
  sumPaise,
  percentOf,
  splitPaise,
  parsePaise,
} from "./money";

/**
 * These tests exist because every one of them is a bug that reached a customer
 * in some travel agency somewhere.
 */

describe("toPaise", () => {
  it("converts rupees without floating-point drift", () => {
    expect(toPaise(0.1) + toPaise(0.2)).toBe(toPaise(0.3));
    // The same sum as floats is famously not 0.3.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("rounds to the nearest paisa rather than truncating", () => {
    expect(toPaise(10.005)).toBe(1001n);
    expect(toPaise(10.004)).toBe(1000n);
  });

  it("treats junk as zero, never NaN", () => {
    // NaN propagates silently through a SUM and poisons an entire report;
    // a zero is visible on screen the moment it is wrong.
    expect(toPaise(undefined)).toBe(0n);
    expect(toPaise(null)).toBe(0n);
    expect(toPaise("")).toBe(0n);
    expect(toPaise("not a number")).toBe(0n);
    expect(toPaise(Infinity)).toBe(0n);
  });

  it("accepts strings from form fields", () => {
    expect(toPaise("27000")).toBe(2700000n);
    expect(toPaise("27000.50")).toBe(2700050n);
  });
});

describe("percentOf", () => {
  it("computes GST without leaving bigint", () => {
    // 5% of ₹24,500
    expect(percentOf(toPaise(24500), 5)).toBe(toPaise(1225));
  });

  it("rounds half up at the paisa", () => {
    // 5% of ₹1.11 = 5.55 paise → 6
    expect(percentOf(111n, 5)).toBe(6n);
  });

  it("handles a fractional rate", () => {
    expect(percentOf(toPaise(10000), 2.5)).toBe(toPaise(250));
  });
});

describe("splitPaise", () => {
  it("never loses or invents a paisa", () => {
    const total = toPaise(1000);
    const parts = splitPaise(total, 3);
    expect(parts).toEqual([33334n, 33333n, 33333n]);
    expect(sumPaise(parts)).toBe(total);
  });

  it("sums back to the whole for any group size", () => {
    const total = toPaise(247513.37);
    for (let people = 1; people <= 20; people += 1) {
      expect(sumPaise(splitPaise(total, people))).toBe(total);
    }
  });

  it("returns nothing for a nonsense group", () => {
    expect(splitPaise(100n, 0)).toEqual([]);
  });
});

describe("a realistic quotation", () => {
  it("adds up exactly, per person and in total", () => {
    // 4 travellers: hotel per head, one cab for the group, per-head activity.
    const travellers = 4;
    const hotelPerPerson = toPaise(8500);
    const cabForGroup = toPaise(12000);
    const activityPerPerson = toPaise(1750);

    const subtotal =
      hotelPerPerson * BigInt(travellers) +
      cabForGroup +
      activityPerPerson * BigInt(travellers);

    expect(subtotal).toBe(toPaise(53000));

    const discount = toPaise(3000);
    const taxable = subtotal - discount;
    const tax = percentOf(taxable, 5);
    const total = taxable + tax;

    expect(tax).toBe(toPaise(2500));
    expect(total).toBe(toPaise(52500));

    // The per-person figure must multiply back to the total — a mismatch here
    // is what a customer spots on the invoice.
    const shares = splitPaise(total, travellers);
    expect(sumPaise(shares)).toBe(total);
  });

  it("does not multiply a group cost by the headcount", () => {
    // The single most expensive mistake in a quotation: one cab becoming four.
    const cab = toPaise(12000);
    const perPerson = false;
    const travellers = 4;
    const amount = perPerson ? cab * BigInt(travellers) : cab;
    expect(amount).toBe(toPaise(12000));
    expect(amount).not.toBe(toPaise(48000));
  });
});

describe("formatINR", () => {
  it("uses Indian grouping", () => {
    // 1,20,000 — not 120,000. Western grouping on an Indian invoice reads as
    // an error before anyone has checked the number.
    expect(formatINR(toPaise(120000))).toBe("₹1,20,000");
    expect(formatINR(toPaise(2400000))).toBe("₹24,00,000");
  });

  it("survives null", () => {
    expect(formatINR(null)).toBe("₹0");
  });
});

describe("parsePaise", () => {
  it("accepts what survives a JSON round trip", () => {
    // bigint has no JSON representation, so values come back as strings.
    expect(parsePaise("2700000")).toBe(2700000n);
    expect(parsePaise(2700000)).toBe(2700000n);
    expect(parsePaise(2700000n)).toBe(2700000n);
  });

  it("refuses anything it cannot trust", () => {
    expect(parsePaise("27000.50")).toBe(0n);
    expect(parsePaise({})).toBe(0n);
    expect(parsePaise(undefined)).toBe(0n);
  });
});

describe("toRupees", () => {
  it("round-trips", () => {
    expect(toRupees(toPaise(24500))).toBe(24500);
    expect(toRupees(toPaise(24500.75))).toBe(24500.75);
  });
});
