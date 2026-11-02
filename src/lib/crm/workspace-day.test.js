import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/cms/records", () => ({ listRecords: vi.fn(async () => []) }));

const { dueBucket, startOfDay } = await import("@/lib/crm/workspace");

/**
 * The desk's day is IST whatever the server's clock says (review 2026-10-14,
 * F18). Vercel runs in UTC: before this, a 9 p.m. IST call-back was "tomorrow".
 */
describe("due buckets in IST", () => {
  // 14 Oct 2026, 19:10 IST = 13:40 UTC.
  const now = new Date("2026-10-14T13:40:00Z");

  it("puts 11 p.m. IST tonight under today", () => {
    expect(dueBucket({ followUpAt: "2026-10-14T17:30:00Z" }, now)).toBe("today");
  });

  it("puts 1 a.m. IST under tomorrow, even though it is still the 14th in UTC", () => {
    expect(dueBucket({ followUpAt: "2026-10-14T19:30:00Z" }, now)).toBe("tomorrow");
  });

  it("puts this morning's missed call under overdue only if it was yesterday", () => {
    expect(dueBucket({ followUpAt: "2026-10-14T03:00:00Z" }, now)).toBe("today");
    expect(dueBucket({ followUpAt: "2026-10-13T18:00:00Z" }, now)).toBe("overdue");
  });

  it("starts the day at IST midnight", () => {
    expect(startOfDay(now).toISOString()).toBe("2026-10-13T18:30:00.000Z");
  });
});
