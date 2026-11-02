import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The SLA ladder.
 *
 * The business-hours arithmetic is the part worth testing properly: counting
 * overnight against a salesperson produces alerts nobody believes, and alerts
 * nobody believes are worse than no alerts.
 */

const store = { leads: [] };
const emitted = [];

vi.mock("@/lib/cms/records", () => ({
  listRecords: vi.fn(async () => store.leads),
  updateRecord: vi.fn(async (_c, id, patch) => {
    const row = store.leads.find((l) => l.id === id);
    Object.assign(row, patch);
    return row;
  }),
  createRecord: vi.fn(),
  getRecord: vi.fn(async (_c, id) => store.leads.find((l) => l.id === id) ?? null),
}));

vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async (type, payload, meta) => {
    emitted.push({ type, payload, meta });
  }),
  timelineFor: vi.fn(async () => []),
}));

const { businessHoursBetween, isUntouched, runSlaChecks } = await import("@/lib/crm/sla");

/** An IST wall-clock time, as the UTC instant it actually is. */
const ist = (day, hour, minute = 0) =>
  Date.UTC(2026, 9, day, hour, minute) - 330 * 60000;

beforeEach(() => {
  store.leads.length = 0;
  emitted.length = 0;
});

describe("businessHoursBetween", () => {
  it("counts hours inside the working day", () => {
    expect(businessHoursBetween(ist(1, 10), ist(1, 14))).toBeCloseTo(4, 5);
  });

  it("does not count the night", () => {
    // 6pm to 10am next morning is one working hour, not sixteen. This is the
    // whole reason the function exists.
    expect(businessHoursBetween(ist(1, 18), ist(2, 10))).toBeCloseTo(2, 5);
  });

  it("ignores time before opening", () => {
    // An enquiry at 7am has not been ignored by 10am — only one hour of the
    // desk's day has passed.
    expect(businessHoursBetween(ist(1, 7), ist(1, 10))).toBeCloseTo(1, 5);
  });

  it("ignores time after closing", () => {
    expect(businessHoursBetween(ist(1, 18), ist(1, 23))).toBeCloseTo(1, 5);
  });

  it("counts a whole day as the length of the working day", () => {
    expect(businessHoursBetween(ist(1, 9), ist(2, 9))).toBeCloseTo(10, 5);
  });

  it("spans several days", () => {
    expect(businessHoursBetween(ist(1, 15), ist(3, 11))).toBeCloseTo(4 + 10 + 2, 5);
  });

  it("returns 0 for an overnight gap entirely outside hours", () => {
    expect(businessHoursBetween(ist(1, 20), ist(1, 23))).toBe(0);
    expect(businessHoursBetween(ist(1, 21), ist(2, 8))).toBe(0);
  });

  it("returns 0 when the end is not after the start", () => {
    expect(businessHoursBetween(ist(1, 12), ist(1, 12))).toBe(0);
    expect(businessHoursBetween(ist(1, 14), ist(1, 10))).toBe(0);
  });
});

describe("isUntouched", () => {
  it("is true for a new lead nobody has acted on", () => {
    expect(isUntouched({ status: "new", calls: [], notes: [] })).toBe(true);
    expect(isUntouched({ status: "new" })).toBe(true);
  });

  it("is false once anything has happened", () => {
    expect(isUntouched({ status: "new", calls: [{ outcome: "no-answer" }] })).toBe(false);
    expect(isUntouched({ status: "new", notes: [{ body: "left a voicemail" }] })).toBe(false);
    expect(isUntouched({ status: "contacted" })).toBe(false);
  });
});

describe("runSlaChecks", () => {
  const lead = (over) => ({
    id: "lead_1",
    status: "new",
    name: "Anita",
    phone: "9876543210",
    destination: "Kerala",
    ownerId: "u_priya",
    calls: [],
    notes: [],
    ...over,
  });

  it("stays quiet inside the nudge window", async () => {
    store.leads.push(lead({ createdAt: new Date(ist(1, 10)).toISOString() }));
    const result = await runSlaChecks({ now: ist(1, 12) });
    expect(result).toMatchObject({ nudged: 0, escalated: 0 });
    expect(emitted).toHaveLength(0);
  });

  it("nudges the owner after four working hours", async () => {
    store.leads.push(lead({ createdAt: new Date(ist(1, 10)).toISOString() }));
    const result = await runSlaChecks({ now: ist(1, 15) });
    expect(result.nudged).toBe(1);
    expect(emitted[0].type).toBe("lead.sla.nudge");
    expect(emitted[0].meta.ownerId).toBe("u_priya");
  });

  it("escalates after a working day", async () => {
    store.leads.push(lead({ createdAt: new Date(ist(1, 10)).toISOString() }));
    const result = await runSlaChecks({ now: ist(2, 12) });
    expect(result.escalated).toBe(1);
    expect(emitted[0].type).toBe("lead.sla.escalated");
  });

  it("never sends the same nudge twice, however often it runs", async () => {
    store.leads.push(lead({ createdAt: new Date(ist(1, 10)).toISOString() }));
    await runSlaChecks({ now: ist(1, 15) });
    await runSlaChecks({ now: ist(1, 16) });
    await runSlaChecks({ now: ist(1, 17) });
    expect(emitted.filter((e) => e.type === "lead.sla.nudge")).toHaveLength(1);
  });

  it("escalates a lead that was already nudged, exactly once", async () => {
    store.leads.push(lead({ createdAt: new Date(ist(1, 10)).toISOString() }));
    await runSlaChecks({ now: ist(1, 15) });
    await runSlaChecks({ now: ist(2, 12) });
    await runSlaChecks({ now: ist(2, 15) });
    expect(emitted.filter((e) => e.type === "lead.sla.escalated")).toHaveLength(1);
  });

  it("leaves a lead alone once somebody has called it", async () => {
    store.leads.push(
      lead({
        createdAt: new Date(ist(1, 10)).toISOString(),
        calls: [{ outcome: "no-answer", at: new Date(ist(1, 11)).toISOString() }],
      })
    );
    const result = await runSlaChecks({ now: ist(2, 12) });
    expect(result).toMatchObject({ checked: 0, nudged: 0, escalated: 0 });
  });

  it("does not count an overnight enquiry against the desk", async () => {
    // Came in at 9pm, checked at 9am. The desk was shut; nobody is late.
    store.leads.push(lead({ createdAt: new Date(ist(1, 21)).toISOString() }));
    const result = await runSlaChecks({ now: ist(2, 9) });
    expect(result.nudged).toBe(0);
  });

  it("skips a lead with no usable createdAt rather than alerting on it", async () => {
    store.leads.push(lead({ createdAt: null }));
    const result = await runSlaChecks({ now: ist(5, 12) });
    expect(result).toMatchObject({ checked: 0, nudged: 0 });
  });
});
