import { describe, it, expect } from "vitest";
import { buildRegister, registerCsv } from "@/lib/crm/register";
import { resolvePeriod } from "@/lib/crm/periods";

const now = new Date("2026-10-14T13:40:00Z"); // Wed 14 Oct, 19:10 IST
const leads = [
  { id: "l1", name: "Sharma", phone: "9811122233", source: "website" },
  { id: "l2", name: "Mehra", phone: "9811100000", source: "ai-planner" },
];
const users = [{ id: "u1", name: "Priya" }, { id: "u2", name: "Arjun" }];

const q = (over) => ({ version: 1, travellers: 2, total: 100000, perPerson: 50000, ownerId: "u1", leadId: "l1", ...over });

const quotations = [
  // Sharma: v1 sent, then revised to v2 and approved — one customer, one value.
  q({ id: "a1", status: "superseded", sentAt: "2026-10-12T05:00:00Z" }),
  q({ id: "a2", version: 2, status: "approved", total: 90000, grossMargin: 15000, sentAt: "2026-10-13T05:00:00Z" }),
  // Mehra: sent today, still waiting; and an old one last month.
  q({ id: "b1", leadId: "l2", ownerId: "u2", status: "sent", total: 250000, sentAt: "2026-10-14T06:00:00Z" }),
  q({ id: "b0", leadId: "l2", ownerId: "u2", status: "rejected", total: 40000, sentAt: "2026-09-20T06:00:00Z" }),
  // A draft — never counted as sent.
  q({ id: "d1", leadId: "l2", status: "draft", createdAt: "2026-10-14T07:00:00Z" }),
];

describe("the quotation register", () => {
  const period = resolvePeriod("week", { now });

  it("counts every version sent but values only the one still standing", () => {
    const { kpis } = buildRegister({ quotations, leads, users, period, now });
    expect(kpis.sentCount).toBe(3);
    expect(kpis.revisions).toBe(1);
    expect(kpis.customers).toBe(2);
    expect(kpis.sentValue).toBe(90000 + 250000);
    expect(kpis.approvedValue).toBe(90000);
    expect(kpis.openValue).toBe(250000);
    expect(kpis.winRate).toBe(100); // the only decided one was approved
    expect(kpis.draftCount).toBe(1);
  });

  it("keeps last month's quotation out of this week", () => {
    const { rows } = buildRegister({ quotations, leads, users, period, now });
    expect(rows.map((r) => r.id)).not.toContain("b0");
  });

  it("filters by status, salesperson and customer search", () => {
    expect(buildRegister({ quotations, leads, users, period, now, filters: { status: "open" } }).rows.map((r) => r.id)).toEqual(["b1"]);
    expect(buildRegister({ quotations, leads, users, period, now, filters: { ownerId: "u1" } }).kpis.sentValue).toBe(90000);
    expect(buildRegister({ quotations, leads, users, period, now, filters: { query: "98111 22233" } }).rows.map((r) => r.customerName)).toEqual(["Sharma", "Sharma"]);
    expect(buildRegister({ quotations, leads, users, period, now, filters: { status: "draft" } }).rows.map((r) => r.id)).toEqual(["d1"]);
  });

  it("buckets value by IST day, one series per chart", () => {
    const { series } = buildRegister({ quotations, leads, users, period, now, granularity: "day" });
    const byKey = Object.fromEntries(series.map((b) => [b.key, b]));
    expect(byKey["2026-10-12"].count).toBe(1);
    expect(byKey["2026-10-12"].value).toBe(0); // superseded
    expect(byKey["2026-10-13"].approvedValue).toBe(90000);
    expect(byKey["2026-10-14"].value).toBe(250000);
    // The series sums to the headline.
    expect(series.reduce((s, b) => s + b.value, 0)).toBe(340000);
  });

  it("marks a sent quotation past its validity as expired", () => {
    const stale = [q({ id: "e1", status: "sent", sentAt: "2026-10-12T05:00:00Z", validUntil: "2026-10-13T00:00:00Z" })];
    const { rows, kpis } = buildRegister({ quotations: stale, leads, users, period, now });
    expect(rows[0].status).toBe("expired");
    expect(kpis.openCount).toBe(0);
  });
});

describe("register CSV", () => {
  it("escapes, guards formulas and hides margin unless asked", () => {
    const rows = [
      { sentAt: "2026-10-14T06:00:00Z", customerName: 'Rao, "Ravi"', customerPhone: "=HYPERLINK(1)", title: "Goa", version: 1, status: "sent", total: 1000, grossMargin: 200 },
    ];
    const csv = registerCsv(rows);
    expect(csv.split("\n")[1]).toContain('"Rao, ""Ravi"""');
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).not.toContain("Margin");
    expect(registerCsv(rows, { withMargin: true })).toContain("Margin (INR)");
  });
});
