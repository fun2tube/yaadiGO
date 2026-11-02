import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  listRecords: vi.fn(async () => []),
  getRecord: vi.fn(async () => null),
  upsertBy: vi.fn(),
}));
vi.mock("@/lib/crm/events", () => ({ emit: vi.fn(async () => {}), timelineFor: vi.fn(async () => []) }));
vi.mock("@/lib/crm/leads", () => ({ LEADS: "leads", setStage: vi.fn(async () => ({})) }));

const { priceQuotation } = await import("@/lib/crm/quotations");

/**
 * Quotation arithmetic.
 *
 * These exist because a probe found real drift: twelve lines at ₹1,016.67 for
 * seven people came out as `89670.28000000001` — a paisa low, and carrying an
 * artifact that would have printed on a customer's PDF. Whole-rupee pricing
 * never drifted, which is why this was hygiene rather than an emergency.
 */

const line = (over = {}) => ({
  label: "x",
  quantity: 1,
  unitPrice: 1000,
  unitCost: 800,
  perPerson: false,
  ...over,
});

describe("priceQuotation — exactness", () => {
  it("has no float artifact on many fractional per-person lines", () => {
    const lines = Array.from({ length: 12 }, () => line({ unitPrice: 1016.67, perPerson: true }));
    const { subtotal } = priceQuotation({ lines, travellers: 7, taxPercent: 0 });

    // 1016.67 × 12 × 7 = 85,400.28 exactly.
    expect(subtotal).toBe(85400.28);
    expect(String(subtotal)).not.toContain("000000");
  });

  it("adds tenths exactly", () => {
    const { subtotal } = priceQuotation({
      lines: [line({ unitPrice: 0.1 }), line({ unitPrice: 0.2 })],
      taxPercent: 0,
    });
    // The canonical float trap: 0.1 + 0.2 === 0.30000000000000004.
    expect(subtotal).toBe(0.3);
  });

  it("is unchanged for whole-rupee pricing, which is the normal case", () => {
    const { subtotal, tax, total } = priceQuotation({
      lines: [line({ unitPrice: 8000, quantity: 4, perPerson: true })],
      travellers: 2,
      taxPercent: 5,
    });
    expect(subtotal).toBe(64000);
    expect(tax).toBe(3200);
    expect(total).toBe(67200);
  });

  it("applies a discount before tax, exactly", () => {
    const { subtotal, discount, tax, total } = priceQuotation({
      lines: [line({ unitPrice: 10000.5 })],
      discount: 500.25,
      taxPercent: 5,
    });
    // 10000.50 - 500.25 = 9500.25 taxable, exactly.
    expect(subtotal).toBe(10000.5);
    expect(discount).toBe(500.25);
    // Tax is deliberately rounded to whole rupees — a business rule, not drift.
    expect(tax).toBe(475);
    expect(total).toBe(9975.25);
  });

  it("multiplies per-person lines by quantity AND headcount", () => {
    const { subtotal } = priceQuotation({
      lines: [line({ unitPrice: 2500, quantity: 3, perPerson: true })],
      travellers: 4,
      taxPercent: 0,
    });
    expect(subtotal).toBe(30000);
  });

  it("reports margin on the pre-tax figure, never counting GST as earnings", () => {
    const { marginPercent } = priceQuotation({
      lines: [line({ unitPrice: 1000, unitCost: 800 })],
      taxPercent: 18,
    });
    // 200 / 1000 = 20%. Including tax would flatter it.
    expect(marginPercent).toBe(20);
  });

  it("returns an unknown margin rather than 100% when no cost was entered", () => {
    const { marginPercent } = priceQuotation({
      lines: [line({ unitPrice: 1000, unitCost: 0 })],
      taxPercent: 0,
    });
    // Telling a salesperson they have 100% margin is the most expensive way to
    // be confidently wrong.
    expect(marginPercent).toBeNull();
  });

  it("never lets a discount exceed the subtotal", () => {
    const { discount, total } = priceQuotation({
      lines: [line({ unitPrice: 1000 })],
      discount: 99999,
      taxPercent: 0,
    });
    // Capped at the subtotal, so the total floors at zero rather than going
    // negative and turning a quotation into a refund.
    expect(discount).toBe(1000);
    expect(total).toBe(0);
  });
});
