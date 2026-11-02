import { describe, it, expect } from "vitest";
import { computeReport, teamCsv } from "@/lib/crm/analytics";
import { buildRegister } from "@/lib/crm/register";
import { resolvePeriod } from "@/lib/crm/periods";

const now = new Date("2026-10-14T13:40:00Z");
const period = resolvePeriod("month", { now }); // October 2026, previous = September

const users = [
  { id: "u1", name: "Priya", role: "sales", status: "active", monthlyTarget: 300000 },
  { id: "u2", name: "Arjun", role: "sales", status: "active" },
];

const leads = [
  // October: three enquiries.
  { id: "l1", name: "Sharma", source: "website", destination: "Kashmir", ownerId: "u1", status: "won", receivedAt: "2026-10-02T05:00:00Z", convertedAt: "2026-10-06T05:00:00Z" },
  { id: "l2", name: "Mehra", source: "ai-planner", destination: "Kerala", ownerId: "u2", status: "quoted", receivedAt: "2026-10-05T05:00:00Z" },
  { id: "l3", name: "Rao", source: "website", destination: "kashmir ", ownerId: "u1", status: "lost", lostReason: "Price", receivedAt: "2026-10-08T05:00:00Z", updatedAt: "2026-10-10T05:00:00Z" },
  // September: one.
  { id: "l0", name: "Old", source: "website", destination: "Goa", ownerId: "u1", status: "won", receivedAt: "2026-09-10T05:00:00Z", convertedAt: "2026-09-15T05:00:00Z" },
];

const quotations = [
  { id: "q1", leadId: "l1", ownerId: "u1", version: 1, status: "approved", total: 120000, destination: "Kashmir", sentAt: "2026-10-03T05:00:00Z", decidedAt: "2026-10-06T05:00:00Z" },
  { id: "q2", leadId: "l2", ownerId: "u2", version: 1, status: "sent", total: 200000, destination: "Kerala", sentAt: "2026-10-06T05:00:00Z" },
  { id: "q0", leadId: "l0", ownerId: "u1", version: 1, status: "approved", total: 50000, destination: "Goa", sentAt: "2026-09-11T05:00:00Z", decidedAt: "2026-09-15T05:00:00Z" },
];

const bookings = [
  { id: "b1", leadId: "l1", salesOwnerId: "u1", status: "part-paid", total: 120000, collected: 10000, createdAt: "2026-10-06T05:00:00Z" },
  { id: "b0", leadId: "l0", salesOwnerId: null, status: "completed", total: 50000, collected: 50000, createdAt: "2026-09-15T05:00:00Z" },
];

const payments = [
  { id: "p1", bookingId: "b1", amount: 10000, receivedAt: "2026-10-07T05:00:00Z" },
  { id: "p0", bookingId: "b0", amount: 50000, receivedAt: "2026-09-20T05:00:00Z" },
];

const events = [
  { type: "lead.stage", leadId: "l1", at: "2026-10-02T05:20:00Z" }, // 20 min
  { type: "lead.stage", leadId: "l2", at: "2026-10-05T07:00:00Z" }, // 120 min
];

const report = computeReport({ users, leads, quotations, bookings, payments, events, period, now });

describe("headline and comparison", () => {
  it("reports October so far and compares with the same days of September", () => {
    expect(report.headline).toMatchObject({
      enquiries: 3,
      quotesSent: 2,
      quotedValue: 320000,
      approvedCount: 1,
      approvedValue: 120000,
      bookings: 1,
      bookedValue: 120000,
      collected: 10000,
      won: 1,
      lost: 1,
      winRate: 50,
      firstResponseMedian: 70,
      respondedWithinHour: 50,
    });
    // Like for like: 1–14 Sep. September's booking (15th) and payment (20th) fall after it.
    expect(report.previous).toMatchObject({ enquiries: 1, bookedValue: 0, collected: 0 });
    expect(report.deltas.enquiries).toBe(200);
    expect(report.deltas.collected).toBeNull(); // nothing to compare with
  });

  it("agrees with the quotation register for the same period", () => {
    const reg = buildRegister({ quotations, leads, users, period, now }).kpis;
    expect(report.headline.quotesSent).toBe(reg.sentCount);
    expect(report.headline.quotedValue).toBe(reg.sentValue);
  });
});

describe("funnel", () => {
  it("follows this period's enquiries down to money received", () => {
    const counts = Object.fromEntries(report.funnel.map((s) => [s.key, s.count]));
    expect(counts).toEqual({ enquiries: 3, contacted: 3, quoted: 2, approved: 1, booked: 1, paid: 1 });
    expect(report.funnel.find((s) => s.key === "booked").ofStart).toBe(33);
  });
});

describe("the sales team", () => {
  it("credits each person with their own work, and the rows sum to the headline", () => {
    const priya = report.team.find((r) => r.name === "Priya");
    const arjun = report.team.find((r) => r.name === "Arjun");
    expect(priya).toMatchObject({ assigned: 2, quotesSent: 1, bookedValue: 120000, collected: 10000, won: 1, lost: 1, winRate: 50 });
    expect(arjun).toMatchObject({ assigned: 1, quotesSent: 1, quotedValue: 200000, bookedValue: 0, firstResponseMedian: 120 });
    const sumOf = (k) => report.team.reduce((t, r) => t + r[k], 0);
    expect(sumOf("quotedValue")).toBe(report.headline.quotedValue);
    expect(sumOf("bookedValue")).toBe(report.headline.bookedValue);
  });

  it("scales a monthly target to the period", () => {
    const priya = report.team.find((r) => r.name === "Priya");
    expect(priya.target).toBe(Math.round((300000 * report.period.days) / 30));
    expect(priya.targetPercent).toBe(Math.round((120000 / priya.target) * 100));
  });

  it("exports the scorecard as CSV", () => {
    const csv = teamCsv(report.team);
    expect(csv.split("\n")).toHaveLength(report.team.length + 1);
    expect(csv).toContain("Priya");
  });
});

describe("breakdowns", () => {
  it("groups sources and destinations, case-insensitively", () => {
    const web = report.sources.find((s) => s.source === "website");
    expect(web).toMatchObject({ enquiries: 2, bookings: 1, bookedValue: 120000, conversion: 50 });
    const kashmir = report.destinations.find((d) => d.destination.toLowerCase() === "kashmir");
    expect(kashmir.enquiries).toBe(2);
    expect(kashmir.bookedValue).toBe(120000);
    expect(report.lostReasons).toEqual([["Price", 1]]);
  });

  it("draws twelve months of trend ending this month", () => {
    expect(report.trend).toHaveLength(12);
    expect(report.trend.at(-1).key).toBe("2026-10");
    expect(report.trend.at(-1).bookedValue).toBe(120000);
    expect(report.trend.at(-2).collected).toBe(50000);
  });
});
