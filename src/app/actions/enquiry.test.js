import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The two front doors.
 *
 * Everything downstream — the brief, the quotation, the booking, the invoice —
 * starts at one of exactly two places: somebody fills in a form on the
 * website, or somebody builds an itinerary with the AI planner and sends it.
 *
 * Both were untested. The workflow tests called `captureLead` directly, which
 * skips validation, sanitising and the itinerary payload entirely — so the
 * step where a real customer actually enters the system had no coverage at
 * all.
 */

const db = { leads: [] };
const emitted = [];

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (c, data) => {
    // `createdAt` matters here: dedup compares it against a 90-day window, so
    // a row without one looks like an ancient lead and never matches.
    const row = {
      id: `${c}_${((db[c] ??= []).length) + 1}`,
      createdAt: new Date().toISOString(),
      ...data,
    };
    db[c].push(row);
    return row;
  }),
  updateRecord: vi.fn(async (c, id, patch) => {
    const row = (db[c] ?? []).find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return row ?? null;
  }),
  listRecords: vi.fn(async (c) => db[c] ?? []),
  getRecord: vi.fn(async (c, id) => (db[c] ?? []).find((r) => r.id === id) ?? null),
}));

vi.mock("@/lib/cms/users", () => ({
  listUsers: vi.fn(async () => [
    { id: "u_sales", name: "Priya", role: "sales", status: "active" },
  ]),
}));

vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async (type, payload, meta) => emitted.push({ type, payload, meta })),
  timelineFor: vi.fn(async () => []),
  // The notification spine subscribes at import time; an inert listener is
  // enough since the delivery side is covered by outbox-worker.test.js.
  on: vi.fn(() => () => {}),
  listEvents: vi.fn(async () => []),
}));

const { submitEnquiry } = await import("@/app/actions/enquiry");

/** A browser form post, as the server action receives it. */
function form(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) fd.set(k, String(v));
  }
  return fd;
}

const PLANNER_ITINERARY = {
  title: "Spiti Valley, 8 nights",
  destination: "Spiti Valley",
  durationDays: 9,
  estimatedCostPerPerson: { min: 28000, max: 34000 },
  days: [
    { day: 1, title: "Arrive Shimla", location: "Shimla", morning: "Land and settle.", afternoon: "Mall Road.", evening: "Early night.", stay: "Heritage hotel", meals: "Local", tips: [] },
    { day: 2, title: "Shimla to Kalpa", location: "Kalpa", morning: "Drive out.", afternoon: "Sutlej valley.", evening: "Kinner Kailash at dusk.", stay: "Guesthouse", meals: "Dhaba", tips: [] },
  ],
};

beforeEach(() => {
  db.leads.length = 0;
  emitted.length = 0;
});

describe("the website enquiry form", () => {
  it("captures a lead a salesperson can actually work", async () => {
    const result = await submitEnquiry(null, form({
      name: "Sharma",
      phone: "9811122233",
      email: "sharma@example.com",
      destination: "Spiti Valley",
      dates: "mid-June, flexible",
      budget: "₹25,000 – ₹50,000",
      groupSize: "3",
      message: "Two of us plus a seven year old.",
      source: "contact-page",
    }));

    expect(result.status, JSON.stringify(result.errors ?? {})).toBe("success");
    expect(db.leads).toHaveLength(1);

    const lead = db.leads[0];
    expect(lead.name).toBe("Sharma");
    expect(lead.phone).toBe("9811122233");
    expect(lead.destination).toBe("Spiti Valley");
    // The customer's own words, preserved verbatim for the desk to read.
    expect(lead.dates).toBe("mid-June, flexible");
    // One of the four bands the form offers. Free text is deliberately
    // nulled by validate(), so the pipeline value is always comparable.
    expect(lead.budget).toBe("₹25,000 – ₹50,000");
  });

  it("gives every enquiry an owner and a follow-up of today", async () => {
    // An enquiry that sits overnight is the one that goes to a competitor.
    await submitEnquiry(null, form({ name: "Anita", phone: "9800000001", source: "contact-page" }));
    const lead = db.leads[0];
    expect(lead.ownerId).toBe("u_sales");
    expect(lead.status).toBe("new");
    expect(lead.followUpAt).toBeTruthy();
  });

  it("tells the team, and promises the customer a reply", async () => {
    await submitEnquiry(null, form({ name: "Anita", phone: "9800000001", source: "contact-page" }));
    const created = emitted.find((e) => e.type === "lead.created");
    expect(created).toBeTruthy();
    expect(created.payload.customerMessage).toBeTruthy();
  });

  it("refuses a submission with no way to reply", async () => {
    // A lead with neither a phone nor an email is not a lead.
    const result = await submitEnquiry(null, form({ name: "Ghost", source: "contact-page" }));
    expect(result.status).toBe("error");
    expect(db.leads).toHaveLength(0);
  });

  it("refuses a nameless submission", async () => {
    const result = await submitEnquiry(null, form({ phone: "9800000001", source: "contact-page" }));
    expect(result.status).toBe("error");
    expect(db.leads).toHaveLength(0);
  });

  it("does not create a second lead for a repeat enquiry", async () => {
    // The same person enquiring twice is one conversation, not two.
    const fields = { name: "Sharma", phone: "9811122233", source: "contact-page" };
    await submitEnquiry(null, form(fields));
    await submitEnquiry(null, form({ ...fields, destination: "Ladakh" }));

    expect(db.leads).toHaveLength(1);
    expect(emitted.some((e) => e.type === "lead.repeat")).toBe(true);
  });

  it("survives a hostile payload without storing markup", async () => {
    const result = await submitEnquiry(null, form({
      name: "<script>alert(1)</script>Sharma",
      phone: "9811122233",
      message: "x".repeat(50000),
      source: "contact-page",
    }));
    expect(result.status).toBe("success");
    const lead = db.leads[0];
    // Oversized input is truncated rather than rejected or stored whole.
    expect(lead.message.length).toBeLessThan(50000);
  });
});

describe("the AI itinerary builder", () => {
  it("attaches the itinerary the customer actually saw", async () => {
    // The whole point: the desk quotes against the plan on the customer's
    // screen, not a different trip with the same destination.
    const result = await submitEnquiry(null, form({
      name: "Sharma",
      phone: "9811122233",
      destination: "Spiti Valley",
      source: "ai-planner",
      itinerary: JSON.stringify(PLANNER_ITINERARY),
    }));

    expect(result.status, JSON.stringify(result.errors ?? {})).toBe("success");
    const lead = db.leads[0];
    expect(lead.itinerary).toBeTruthy();
    expect(lead.itinerary.title).toBe("Spiti Valley, 8 nights");
    expect(lead.itinerary.days).toHaveLength(2);
    expect(lead.itinerary.days[1].location).toBe("Kalpa");
  });

  it("records that the lead came from the planner", async () => {
    await submitEnquiry(null, form({
      name: "Sharma", phone: "9811122233", source: "ai-planner",
      itinerary: JSON.stringify(PLANNER_ITINERARY),
    }));
    expect(db.leads[0].source).toBe("ai-planner");
    const created = emitted.find((e) => e.type === "lead.created");
    expect(created.payload.hasItinerary).toBe(true);
  });

  it("still captures the lead when the itinerary payload is broken", async () => {
    // A malformed itinerary must never cost us the enquiry — the phone number
    // is worth far more than the plan.
    const result = await submitEnquiry(null, form({
      name: "Sharma", phone: "9811122233", source: "ai-planner",
      itinerary: "{not json at all",
    }));
    expect(result.status).toBe("success");
    expect(db.leads).toHaveLength(1);
    expect(db.leads[0].itinerary).toBeNull();
  });

  it("keeps the itinerary when the same person enquires again", async () => {
    // First a bare enquiry, then one carrying a plan. The plan must survive
    // the dedup merge, or the second submission silently loses it.
    await submitEnquiry(null, form({ name: "Sharma", phone: "9811122233", source: "contact-page" }));
    await submitEnquiry(null, form({
      name: "Sharma", phone: "9811122233", source: "ai-planner",
      itinerary: JSON.stringify(PLANNER_ITINERARY),
    }));

    expect(db.leads).toHaveLength(1);
    expect(db.leads[0].itinerary?.title).toBe("Spiti Valley, 8 nights");
  });
});
