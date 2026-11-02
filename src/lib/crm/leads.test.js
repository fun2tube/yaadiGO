import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Lead capture.
 *
 * These are the first tests over the CRM layer. Until now `server-only` made
 * every module here impossible to import under vitest, so the code that moves
 * money had no unit coverage at all — and the end-to-end run on 2026-10-01
 * found two S1 faults that any of this would have caught.
 *
 * The record store and the event spine are stubbed. What is under test is the
 * capture DECISION: is this a new lead or a repeat, and what is it worth.
 */

const store = { leads: [] };
const emitted = [];

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (_collection, data) => {
    const row = { id: `lead_${store.leads.length + 1}`, createdAt: new Date().toISOString(), ...data };
    store.leads.push(row);
    return row;
  }),
  updateRecord: vi.fn(async (_collection, id, patch) => {
    const row = store.leads.find((l) => l.id === id);
    Object.assign(row, patch);
    return row;
  }),
  listRecords: vi.fn(async () => store.leads),
  getRecord: vi.fn(async (_collection, id) => store.leads.find((l) => l.id === id) ?? null),
}));

vi.mock("@/lib/cms/users", () => ({
  listUsers: vi.fn(async () => [
    { id: "u_priya", name: "Priya", role: "sales", status: "active", permissions: ["leads.write"] },
  ]),
}));

vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async (type, payload, meta) => {
    emitted.push({ type, payload, meta });
    return { type };
  }),
  timelineFor: vi.fn(async () => []),
}));

const { captureLead, estimateLeadValue } = await import("@/lib/crm/leads");

beforeEach(() => {
  store.leads.length = 0;
  emitted.length = 0;
});

describe("estimateLeadValue", () => {
  it("reads the form's label and the planner's key as the same band", () => {
    expect(estimateLeadValue({ budget: "₹25,000 – ₹50,000", groupSize: 2 })).toBe(75000);
    expect(estimateLeadValue({ budget: "comfortable", groupSize: 2 })).toBe(75000);
  });

  it("scales with group size", () => {
    expect(estimateLeadValue({ budget: "premium", groupSize: 4 })).toBe(300000);
  });

  it("returns null rather than a guess when no budget was given", () => {
    // A number with nothing behind it is worse than an empty cell — it would
    // be totalled into a forecast as though it meant something.
    expect(estimateLeadValue({ groupSize: 3 })).toBeNull();
    expect(estimateLeadValue({ budget: "", groupSize: 3 })).toBeNull();
  });

  it("treats a missing group size as one traveller, never zero", () => {
    expect(estimateLeadValue({ budget: "luxury" })).toBe(125000);
  });
});

describe("captureLead — duplicates", () => {
  it("creates one lead for a first enquiry, with an owner and a value", async () => {
    const lead = await captureLead({
      name: "Anita",
      phone: "9876543210",
      destination: "Kerala",
      budget: "comfortable",
      groupSize: 2,
      source: "contact-page",
    });

    expect(store.leads).toHaveLength(1);
    expect(lead.ownerId).toBe("u_priya");
    expect(lead.status).toBe("new");
    expect(lead.value).toBe(75000);
    expect(emitted.map((e) => e.type)).toContain("lead.created");
  });

  it("attaches a repeat enquiry to the existing lead instead of creating a second", async () => {
    await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala", source: "planner" });
    const again = await captureLead({
      name: "Anita",
      phone: "9876543210",
      destination: "Kerala",
      source: "contact-page",
      message: "Still interested, November now",
    });

    // The whole point: two people must not end up calling one customer.
    expect(store.leads).toHaveLength(1);
    expect(again.notes).toHaveLength(1);
    // `body`, not `text` — the shape addNote() has always used. Getting this
    // wrong once is why the assertion is here.
    expect(again.notes[0].body).toContain("Enquired again");
    expect(emitted.map((e) => e.type)).toContain("lead.repeat");
  });

  it("matches the same person across phone formats", async () => {
    await captureLead({ name: "Anita", phone: "+91 98765 43210", destination: "Goa" });
    await captureLead({ name: "Anita", phone: "09876543210", destination: "Goa" });
    expect(store.leads).toHaveLength(1);
  });

  it("matches on email when the phone is absent", async () => {
    await captureLead({ name: "Ravi", email: "ravi@example.com", destination: "Ladakh" });
    await captureLead({ name: "Ravi", email: "RAVI@example.com", destination: "Ladakh" });
    expect(store.leads).toHaveLength(1);
  });

  it("does NOT merge two different people", async () => {
    await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala" });
    await captureLead({ name: "Ravi", phone: "9000000001", destination: "Kerala" });
    expect(store.leads).toHaveLength(2);
  });

  it("starts a fresh lead when the previous one is closed", async () => {
    const first = await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala" });
    first.status = "won";

    await captureLead({ name: "Anita", phone: "9876543210", destination: "Bali" });

    // Somebody who booked and came back is a new opportunity, not a note on a
    // deal that is already closed.
    expect(store.leads).toHaveLength(2);
  });

  it("ignores a duplicate older than the 90-day window", async () => {
    const first = await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala" });
    first.createdAt = new Date(Date.now() - 120 * 86400000).toISOString();

    await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala" });
    expect(store.leads).toHaveLength(2);
  });

  it("pulls a repeat back to the top of the owner's list", async () => {
    const first = await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala" });
    first.followUpAt = new Date(Date.now() + 14 * 86400000).toISOString();

    const again = await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala" });

    // A second enquiry is a buying signal; it outranks whatever date was set.
    expect(new Date(again.followUpAt).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("keeps an itinerary the repeat brought, without losing the original contact details", async () => {
    await captureLead({ name: "Anita", phone: "9876543210", destination: "Kerala" });
    const again = await captureLead({
      phone: "9876543210",
      email: "anita@example.com",
      destination: "Kerala",
      itinerary: { title: "Kerala 6D", days: [{ day: 1 }] },
    });

    expect(again.itinerary.title).toBe("Kerala 6D");
    expect(again.phone).toBe("9876543210");
  });
});

describe("estimateLeadValue — budgets typed in a conversation", () => {
  it("reads a plain per-person number and multiplies by the group", () => {
    // What somebody actually says to Yaadi: "around 30000 each".
    expect(estimateLeadValue({ budget: "30000 each", groupSize: 4 })).toBe(120000);
    expect(estimateLeadValue({ budget: "around ₹45,000 per person", groupSize: 2 })).toBe(90000);
  });

  it("reads lakhs", () => {
    expect(estimateLeadValue({ budget: "1.5 lakh", groupSize: 1 })).toBe(150000);
  });

  it("does NOT multiply when they said it was the total", () => {
    expect(estimateLeadValue({ budget: "2 lakh total", groupSize: 4 })).toBe(200000);
    expect(estimateLeadValue({ budget: "80000 for all of us", groupSize: 2 })).toBe(80000);
  });

  it("still prefers a band when one was chosen", () => {
    // The form's label contains digits too; the band must win over the digits.
    expect(estimateLeadValue({ budget: "comfortable", groupSize: 2 })).toBe(75000);
  });

  it("ignores a number too small to be a travel budget", () => {
    expect(estimateLeadValue({ budget: "4 people", groupSize: 4 })).toBeNull();
  });
});
