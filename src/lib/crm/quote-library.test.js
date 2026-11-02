import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The quotation library.
 *
 * The thing that must not go wrong: a saved quotation carrying one customer's
 * name, dates or contact details into the next customer's document. That is
 * the kind of mistake nobody notices until it has been sent, so it is the
 * first thing asserted here.
 *
 * The second: re-pricing. A template built for two people, applied to a
 * family of five, must not quote the two-person total.
 */

const db = { leads: [], quotations: [], quotationTemplates: [] };
const emitted = [];
let seq = 0;

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (c, data) => {
    const row = { id: `${c}_${++seq}`, createdAt: new Date().toISOString(), ...data };
    (db[c] ??= []).push(row);
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
vi.mock("@/lib/cms/users", () => ({ listUsers: vi.fn(async () => []) }));
vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async (type, payload) => emitted.push({ type, payload })),
  timelineFor: vi.fn(async () => []),
}));

const { saveAsTemplate, listTemplates, applyTemplate, suggestFor, deleteTemplate } = await import(
  "@/lib/crm/quote-library"
);

const SALES = { id: "u_sales", name: "Priya" };

const LINES = [
  { kind: "hotel", label: "Hotels, 8 nights", unitPrice: 24000, quantity: 1, perPerson: true, cost: 18000 },
  { kind: "transport", label: "Tempo traveller", unitPrice: 45000, quantity: 1, perPerson: false, cost: 36000 },
];

const PRESENTATION = {
  template: "detailed",
  heroImageId: "spiti-hero",
  hotels: [{ name: "Hotel Deyzor", city: "Kaza", imageId: "deyzor" }],
  flights: [],
  stayPhotos: ["a", "b"],
};

beforeEach(() => {
  for (const k of Object.keys(db)) db[k].length = 0;
  emitted.length = 0;
  seq = 0;

  db.leads.push({ id: "l_old", name: "Sharma", phone: "9811122233", ownerId: SALES.id, groupSize: 2 });
  db.quotations.push({
    id: "q1", leadId: "l_old", version: 1, status: "approved",
    title: "Spiti Valley — 8 nights", destination: "Spiti Valley", durationDays: 9,
    travellers: 2, startDate: "2026-06-15", summary: "Shimla up, Manali down.",
    lines: LINES, inclusions: ["Hotels"], exclusions: ["Flights"],
    taxPercent: 5, content: PRESENTATION, token: "tok_secret",
    itinerary: { days: [{ day: 1, title: "Arrive Shimla" }] },
  });
});

describe("saving to the library", () => {
  it("keeps everything that describes the trip", async () => {
    const { template } = await saveAsTemplate("q1", {
      name: "Spiti classic", kind: "fixed-departure", tags: ["himalaya"], actor: SALES,
    });

    expect(template.name).toBe("Spiti classic");
    expect(template.kind).toBe("fixed-departure");
    expect(template.destination).toBe("Spiti Valley");
    expect(template.durationDays).toBe(9);
    expect(template.lines).toHaveLength(2);
    expect(template.inclusions).toEqual(["Hotels"]);
    // The presentation is most of the work — hero image, hotel rows,
    // galleries. A library entry without it saves almost nothing.
    expect(template.content.template).toBe("detailed");
    expect(template.content.heroImageId).toBe("spiti-hero");
    expect(template.content.hotels).toHaveLength(1);
  });

  it("carries NOTHING that identifies the original customer", async () => {
    // The worst bug available here: Mr Sharma's name or dates appearing in
    // somebody else's quotation.
    const { template } = await saveAsTemplate("q1", { name: "Spiti classic", kind: "customised", actor: SALES });
    const serialised = JSON.stringify(template);

    expect(serialised).not.toContain("Sharma");
    expect(serialised).not.toContain("9811122233");
    expect(serialised).not.toContain("tok_secret");
    expect(template.leadId).toBeUndefined();
    expect(template.startDate).toBeUndefined();
    expect(template.status).toBeUndefined();
  });

  it("records the head count the prices were built for", async () => {
    const { template } = await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    expect(template.referenceTravellers).toBe(2);
  });

  it("refuses a kind it does not recognise", async () => {
    expect((await saveAsTemplate("q1", { name: "x", kind: "group-ish" })).error).toBeTruthy();
  });

  it("refuses to save a quotation that does not exist", async () => {
    expect((await saveAsTemplate("nope", { name: "x", kind: "customised" })).error).toBeTruthy();
  });

  it("does not let a duplicate name overwrite an existing entry", async () => {
    const a = await saveAsTemplate("q1", { name: "Spiti classic", kind: "customised", actor: SALES });
    const b = await saveAsTemplate("q1", { name: "Spiti classic", kind: "customised", actor: SALES });
    expect(a.template.slug).not.toBe(b.template.slug);
    expect(db.quotationTemplates).toHaveLength(2);
  });
});

describe("the two kinds are kept apart", () => {
  beforeEach(async () => {
    await saveAsTemplate("q1", { name: "Spiti fixed", kind: "fixed-departure", actor: SALES });
    await saveAsTemplate("q1", { name: "Spiti custom", kind: "customised", actor: SALES });
  });

  it("lists only fixed departures when asked for them", async () => {
    const rows = await listTemplates({ kind: "fixed-departure" });
    expect(rows.map((r) => r.name)).toEqual(["Spiti fixed"]);
  });

  it("lists only customised when asked for those", async () => {
    const rows = await listTemplates({ kind: "customised" });
    expect(rows.map((r) => r.name)).toEqual(["Spiti custom"]);
  });

  it("searches by name and destination", async () => {
    expect(await listTemplates({ search: "spiti" })).toHaveLength(2);
    expect(await listTemplates({ search: "kerala" })).toHaveLength(0);
  });
});

describe("reusing one on a new enquiry", () => {
  beforeEach(() => {
    // A bigger family than the template was built for.
    db.leads.push({
      id: "l_new", name: "Verma", phone: "9900000001", ownerId: SALES.id,
      destination: "Spiti Valley", groupSize: 5, adults: 4, children: [{ age: 9 }], infants: 1,
    });
  });

  it("re-prices for whoever is travelling now", async () => {
    const { template } = await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    const { quotation } = await applyTemplate(template.id, { leadId: "l_new", actor: SALES });

    // 4 adults + 1 child = 5 seated heads; the infant is not a priced head.
    expect(quotation.travellers).toBe(5);
    // (24000 x 5) + 45000 = 165000, NOT the two-person 93000.
    expect(quotation.subtotal).toBe(165000);
  });

  it("brings the presentation across", async () => {
    // Regression: `createQuotation` silently dropped `draft.content`, so a
    // reused quotation arrived with no template, no hero and no hotel rows —
    // which is most of what makes reuse worth anything.
    const { template } = await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    const { quotation } = await applyTemplate(template.id, { leadId: "l_new", actor: SALES });

    expect(quotation.content).toBeTruthy();
    expect(quotation.content.template).toBe("detailed");
    expect(quotation.content.heroImageId).toBe("spiti-hero");
  });

  it("belongs to the new customer, not the old one", async () => {
    const { template } = await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    const { quotation } = await applyTemplate(template.id, { leadId: "l_new", actor: SALES });

    expect(quotation.leadId).toBe("l_new");
    expect(quotation.status).toBe("draft");
    expect(quotation.token).not.toBe("tok_secret");
  });

  it("counts the use, so the library sorts by what people actually reach for", async () => {
    const { template } = await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    await applyTemplate(template.id, { leadId: "l_new", actor: SALES });
    const [saved] = await listTemplates();
    expect(saved.usedCount).toBe(1);
    expect(saved.lastUsedAt).toBeTruthy();
  });

  it("refuses to build one without an enquiry", async () => {
    const { template } = await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    expect((await applyTemplate(template.id, {})).error).toBeTruthy();
  });
});

describe("suggesting a match for a new enquiry", () => {
  it("puts the same destination first", async () => {
    await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    db.quotations.push({ ...db.quotations[0], id: "q2", destination: "Kerala", title: "Kerala" });
    await saveAsTemplate("q2", { name: "Kerala backwaters", kind: "customised", actor: SALES });

    const matches = await suggestFor({ destination: "Spiti Valley" });
    expect(matches[0].destination).toBe("Spiti Valley");
  });

  it("suggests nothing rather than something wrong", async () => {
    await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    expect(await suggestFor({ destination: "Iceland" })).toHaveLength(0);
  });
});

describe("archiving", () => {
  it("hides an entry from the picker but keeps it on record", async () => {
    // A quotation built from it six months ago is a document somebody may
    // have to explain.
    const { template } = await saveAsTemplate("q1", { name: "Spiti", kind: "customised", actor: SALES });
    await deleteTemplate(template.id, { actor: SALES });

    expect(await listTemplates()).toHaveLength(0);
    expect(db.quotationTemplates).toHaveLength(1);
    expect(db.quotationTemplates[0].archivedAt).toBeTruthy();
  });
});
