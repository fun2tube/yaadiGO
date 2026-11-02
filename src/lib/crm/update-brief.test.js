import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Saving the trip brief.
 *
 * The record store and the event spine are stubbed, as in leads.test.js. What
 * is under test is the SAVE DECISION: what gets coerced, what gets rejected,
 * what reaches the database and when the timeline hears about it.
 *
 * Worth real coverage because this is the field that the quotation prompt now
 * reads. A value that silently fails to save does not throw — it just produces
 * a quotation priced against an assumption, which is the exact failure this
 * whole feature exists to remove.
 */

const store = { leads: [] };
const emitted = [];

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (_c, data) => {
    const row = { id: `lead_${store.leads.length + 1}`, ...data };
    store.leads.push(row);
    return row;
  }),
  updateRecord: vi.fn(async (_c, id, patch) => {
    const row = store.leads.find((l) => l.id === id);
    Object.assign(row, patch);
    return row;
  }),
  listRecords: vi.fn(async () => store.leads),
  getRecord: vi.fn(async (_c, id) => store.leads.find((l) => l.id === id) ?? null),
}));

vi.mock("@/lib/cms/users", () => ({ listUsers: vi.fn(async () => []) }));

vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async (type, payload) => {
    emitted.push({ type, payload });
  }),
  timelineFor: vi.fn(async () => []),
}));

const { updateBrief } = await import("@/lib/crm/leads");

function seed(extra = {}) {
  store.leads.length = 0;
  emitted.length = 0;
  store.leads.push({
    id: "lead_1",
    name: "Sharma",
    destination: "Spiti",
    dates: "mid-June, flexible",
    budget: "around 40-50k",
    groupSize: 4,
    children: [],
    infants: 0,
    ...extra,
  });
  return "lead_1";
}

beforeEach(() => seed());

describe("updateBrief", () => {
  it("saves the fields the quotation prompt reads", async () => {
    const { lead } = await updateBrief("lead_1", {
      departureDate: "2026-06-15",
      departureFlexible: true,
      adults: 2,
      children: [{ age: 7 }, { age: 3 }],
      infants: 1,
      brief: { hotelCategory: "4-star", mealPlan: "MAP", transportModes: ["car"] },
    });

    expect(lead.departureDate).toBe("2026-06-15");
    expect(lead.departureFlexible).toBe(true);
    expect(lead.adults).toBe(2);
    expect(lead.children).toEqual([{ age: 7 }, { age: 3 }]);
    expect(lead.infants).toBe(1);
    expect(lead.brief.hotelCategory).toBe("4-star");
    expect(lead.brief.mealPlan).toBe("MAP");
  });

  it("never lets an unknown enum reach the database", async () => {
    // A stale client or a hand-edited row must not be able to put a value in
    // that no dropdown can render and no pricing rule understands.
    const { lead } = await updateBrief("lead_1", {
      brief: { hotelCategory: "7-star", mealPlan: "BRUNCH", transportModes: ["car", "teleport"] },
    });
    expect(lead.brief.hotelCategory).toBeNull();
    expect(lead.brief.mealPlan).toBeNull();
    expect(lead.brief.transportModes).toEqual(["car"]);
  });

  it("clamps child ages instead of rejecting the save", async () => {
    const { lead } = await updateBrief("lead_1", {
      children: [{ age: 99 }, { age: -4 }, { age: "8" }],
    });
    // A mistyped age is a typo, not a reason to lose the rest of the brief.
    expect(lead.children).toEqual([{ age: 17 }, { age: 0 }, { age: 8 }]);
  });

  it("saves in pieces, because a brief is filled in during a phone call", async () => {
    await updateBrief("lead_1", { adults: 2 });
    await updateBrief("lead_1", { departureDate: "2026-06-15" });
    const { lead } = await updateBrief("lead_1", { brief: { hotelCategory: "resort" } });

    // Each save leaves the earlier ones alone.
    expect(lead.adults).toBe(2);
    expect(lead.departureDate).toBe("2026-06-15");
    expect(lead.brief.hotelCategory).toBe("resort");
  });

  it("leaves the customer's own words untouched", async () => {
    // `dates` and `budget` are evidence of what they asked for. The confirmed
    // values go in their own columns, never on top of these.
    const { lead } = await updateBrief("lead_1", {
      departureDate: "2026-06-15",
      budgetAmount: 45000,
    });
    expect(lead.dates).toBe("mid-June, flexible");
    expect(lead.budget).toBe("around 40-50k");
    expect(lead.budgetAmount).toBe(45000);
  });

  it("clears a date rather than storing an empty string", async () => {
    await updateBrief("lead_1", { departureDate: "2026-06-15" });
    const { lead } = await updateBrief("lead_1", { departureDate: "" });
    expect(lead.departureDate).toBeNull();
  });

  it("refuses an empty patch instead of emitting a meaningless event", async () => {
    const result = await updateBrief("lead_1", {});
    expect(result.error).toBeTruthy();
    expect(emitted).toHaveLength(0);
  });

  it("refuses a lead that does not exist", async () => {
    expect((await updateBrief("nope", { adults: 2 })).error).toBeTruthy();
  });

  it("reports what still blocks a quotation", async () => {
    const { gaps } = await updateBrief("lead_1", { adults: 2 });
    expect(gaps).toContain("departure date");
    expect(gaps).toContain("hotel category");
    expect(gaps).not.toContain("number of adults");
  });

  it("puts the headline facts on the timeline, once", async () => {
    await updateBrief("lead_1", {
      departureDate: "2026-06-15",
      adults: 2,
      brief: { hotelCategory: "4-star" },
    });
    const events = emitted.filter((e) => e.type === "lead.brief");
    expect(events).toHaveLength(1);
    expect(events[0].payload.summary).toContain("2026-06-15");
    expect(events[0].payload.summary).toContain("2 adults");
  });

  it("stays quiet when only the budget moves", async () => {
    // A brief is edited repeatedly during one call. An event per keystroke
    // buries the timeline, so only the headline facts are logged.
    await updateBrief("lead_1", { budgetAmount: 45000 });
    expect(emitted.filter((e) => e.type === "lead.brief")).toHaveLength(0);
  });
});
