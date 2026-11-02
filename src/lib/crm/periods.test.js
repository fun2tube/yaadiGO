import { describe, it, expect } from "vitest";
import { bucketKey, buckets, change, granularityFor, inPeriod, resolvePeriod } from "@/lib/crm/periods";

// Wednesday 14 Oct 2026, 19:10 IST.
const now = new Date("2026-10-14T13:40:00Z");

describe("periods on the IST calendar", () => {
  it("today runs from IST midnight to the next", () => {
    const p = resolvePeriod("today", { now });
    expect(p.since.toISOString()).toBe("2026-10-13T18:30:00.000Z");
    expect(p.until.toISOString()).toBe("2026-10-14T18:30:00.000Z");
    expect(p.previous.since.toISOString()).toBe("2026-10-12T18:30:00.000Z");
  });

  it("weeks start on Monday", () => {
    expect(resolvePeriod("week", { now }).since.toISOString()).toBe("2026-10-11T18:30:00.000Z"); // Mon 12 Oct IST
  });

  it("this month, last month and the financial year", () => {
    expect(resolvePeriod("month", { now }).since.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    const last = resolvePeriod("last-month", { now });
    expect(last.since.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    expect(last.until.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(resolvePeriod("fy", { now }).since.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(resolvePeriod("quarter", { now }).since.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("custom is inclusive of both days, and falls back when nonsense", () => {
    const p = resolvePeriod("custom", { now, from: "2026-10-01", to: "2026-10-07" });
    expect(p.days).toBe(7);
    expect(resolvePeriod("custom", { now, from: "2026-10-07", to: "2026-10-01" }).key).toBe("month");
    expect(resolvePeriod("nonsense", { now }).key).toBe("month");
  });

  it("a 10:30 p.m. IST quotation counts on its IST day", () => {
    const today = resolvePeriod("today", { now });
    expect(inPeriod("2026-10-14T17:00:00Z", today)).toBe(true); // 22:30 IST on the 14th
    expect(inPeriod("2026-10-14T19:00:00Z", today)).toBe(false); // 00:30 IST on the 15th
  });
});

describe("buckets", () => {
  it("lists every day of a week, labelled", () => {
    const p = resolvePeriod("week", { now });
    const list = buckets(p.since, p.until, "day");
    expect(list).toHaveLength(3); // Mon 12, Tue 13, Wed 14 — the period ends at the end of today
    expect(list[0].label).toBe("12 Oct");
  });

  it("keys an instant to its day, week and month", () => {
    expect(bucketKey("2026-10-14T17:00:00Z", "day")).toBe("2026-10-14");
    expect(bucketKey("2026-10-14T17:00:00Z", "week")).toBe("wk 2026-10-12");
    expect(bucketKey("2026-10-14T17:00:00Z", "month")).toBe("2026-10");
  });

  it("chooses a bucket size the chart can show", () => {
    expect(granularityFor(7)).toBe("day");
    expect(granularityFor(90)).toBe("week");
    expect(granularityFor(365)).toBe("month");
  });

  it("works out change against the previous period", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(5, 0)).toBeNull();
    expect(change(0, 0)).toBe(0);
  });
});

describe("comparison is like for like", () => {
  it("this month on the 14th compares with the 1st–14th of last month", () => {
    const p = resolvePeriod("month", { now });
    expect(p.previous.since.toISOString()).toBe("2026-08-31T18:30:00.000Z"); // 1 Sep IST
    expect(p.previous.until.toISOString()).toBe("2026-09-14T18:30:00.000Z"); // end of 14 Sep IST
  });

  it("this week on a Wednesday compares with last Monday–Wednesday", () => {
    const p = resolvePeriod("week", { now });
    expect(p.previous.since.toISOString()).toBe("2026-10-04T18:30:00.000Z"); // Mon 5 Oct
    expect(p.previous.until.toISOString()).toBe("2026-10-07T18:30:00.000Z"); // end of Wed 7 Oct
  });

  it("last month compares with the month before, capped at its end", () => {
    const p = resolvePeriod("last-month", { now }); // September, 30 days
    expect(p.previous.since.toISOString()).toBe("2026-07-31T18:30:00.000Z"); // 1 Aug
    expect(p.previous.until.toISOString()).toBe("2026-08-30T18:30:00.000Z"); // 30 days later
  });

  it("rolling periods compare with the stretch just before", () => {
    const p = resolvePeriod("7d", { now });
    expect(p.previous.until.getTime()).toBe(p.since.getTime());
  });
});
