import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Do the panels actually render?
 *
 * Every other test in this repo exercises logic. None of them opens a screen,
 * so a page could compile, typecheck and pass 168 tests while throwing on the
 * first real request — a field read off the wrong shape, a `.map` on null, a
 * helper that returns an object where the JSX expects an array.
 *
 * These call each admin page as the async function it is, with the storage
 * layer and the session stubbed, and assert it returns an element tree instead
 * of throwing. That is a smoke test, not a rendering test: it proves the
 * server half of the page survives a request with realistic data. It does NOT
 * prove anything about the client components inside it — buttons, inputs and
 * the forms in `trip-brief` and `invoice-desk` are only exercised by a human
 * clicking them, because there is no DOM environment here by design.
 */

const db = {
  leads: [], quotations: [], bookings: [], payments: [], invoices: [],
  bookingServices: [], events: [], notifications: [], departures: [],
  documents: [], contentOverrides: [], catalogueOverrides: [], outbox: [],
};

const ADMIN = {
  id: "u_admin",
  name: "Owner",
  email: "owner@yaadigo.in",
  role: "admin",
  status: "active",
  permissions: ["*"],
};

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (c, data) => {
    const row = { id: `${c}_x`, ...data };
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
  upsertBy: vi.fn(async () => null),
}));

vi.mock("@/lib/cms/users", () => ({
  listUsers: vi.fn(async () => [ADMIN]),
  getUser: vi.fn(async () => ADMIN),
  // The team screen calls this on load so a fresh deployment always has one
  // way in. It must not actually create anybody during a test.
  ensureBootstrapAdmin: vi.fn(async () => ADMIN),
}));

vi.mock("@/lib/cms/auth", () => ({
  currentUser: vi.fn(async () => ADMIN),
  authorise: vi.fn(async () => ({ user: ADMIN })),
  SESSION_COOKIE: "yaadigo_admin",
}));

// A page that redirects is a FAILED smoke test here — the admin has every
// permission, so a redirect means the page decided it could not render.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to) => {
    throw new Error(`unexpected redirect to ${to}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("unexpected notFound");
  }),
}));

vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async () => {}),
  timelineFor: vi.fn(async () => []),
  listEvents: vi.fn(async () => []),
}));

/** One realistic row in every table, so the panels render populated. */
function seed() {
  for (const key of Object.keys(db)) db[key].length = 0;

  db.leads.push({
    id: "l1",
    name: "Sharma",
    phone: "9811122233",
    email: "sharma@example.com",
    destination: "Spiti",
    dates: "mid-June, flexible",
    budget: "around 40-50k",
    groupSize: 3,
    status: "quoted",
    ownerId: ADMIN.id,
    notes: [],
    interests: [],
    calls: [],
    children: [{ age: 7 }],
    infants: 0,
    adults: 2,
    departureDate: "2026-06-15",
    departureFlexible: true,
    budgetAmount: 45000,
    budgetPerPerson: true,
    brief: { hotelCategory: "3-star", mealPlan: "MAP", transportModes: ["car"], rooms: [] },
    receivedAt: new Date().toISOString(),
    followUpAt: new Date().toISOString(),
  });

  db.quotations.push({
    id: "q1", leadId: "l1", version: 1, status: "sent", title: "Spiti — 8 nights",
    destination: "Spiti", durationDays: 9, travellers: 3, lines: [], inclusions: [],
    exclusions: [], subtotal: 118500, total: 124425, perPerson: 41475, cost: 90000,
    discount: 0, taxPercent: 5, tax: 5925, grossMargin: 28500, ownerId: ADMIN.id,
    token: "tok_1", createdAt: new Date().toISOString(), sentAt: new Date().toISOString(),
  });

  db.bookings.push({
    id: "b1", reference: "YG-0001", source: "quotation", status: "confirmed",
    leadId: "l1", quotationId: "q1", tripTitle: "Spiti — 8 nights", name: "Sharma",
    phone: "9811122233", email: "sharma@example.com", travellers: 3,
    departureLabel: "15 Jun 2026", departureStart: "2026-06-15",
    total: 124425, perPerson: 41475, advance: 15000, balance: 109425, collected: 15000,
    salesOwnerId: ADMIN.id, opsOwnerId: null, handedToOpsAt: null,
    inclusions: [], exclusions: [], notes: [], seatsHeld: 0,
  });

  db.payments.push({
    id: "p1", bookingId: "b1", amount: 15000, kind: "advance",
    method: "Bank transfer", receivedAt: new Date().toISOString(),
  });

  db.invoices.push({
    id: "i1", number: "YG/2026-27/0001", financialYear: "2026-27", sequence: 1,
    bookingId: "b1", leadId: "l1", quotationId: "q1",
    issuedAt: new Date().toISOString(), issuedById: ADMIN.id, issuedByName: ADMIN.name,
    seller: { name: "YaadiGo Networks Pvt Ltd", gstin: null },
    customer: { name: "Sharma", email: "sharma@example.com", phone: "9811122233", gstin: null },
    title: "Spiti — 8 nights", travellers: 3, travelDates: "15 Jun 2026",
    lines: [], subtotal: 118500, discount: 0, taxPercent: 5, tax: 5925, total: 124425,
  });

  db.bookingServices.push({
    id: "s1", bookingId: "b1", kind: "hotel", status: "confirmed",
    title: "Hotel Deyzor, Kaza", cost: 18000,
  });
}

beforeEach(seed);

/** Every screen in the panel, with whatever params it expects. */
const PANELS = [
  ["Overview", () => import("./(signed-in)/page.js"), {}],
  ["Leads", () => import("./(signed-in)/leads/page.js"), { searchParams: Promise.resolve({}) }],
  ["Lead detail", () => import("./(signed-in)/leads/[id]/page.js"), { params: Promise.resolve({ id: "l1" }) }],
  ["Interests", () => import("./(signed-in)/leads/interests/page.js"), {}],
  ["Quotations", () => import("./(signed-in)/quotations/page.js"), { searchParams: Promise.resolve({}) }],
  ["New quotation", () => import("./(signed-in)/quotations/new/page.js"), { searchParams: Promise.resolve({ lead: "l1" }) }],
  ["Quotation detail", () => import("./(signed-in)/quotations/[id]/page.js"), { params: Promise.resolve({ id: "q1" }) }],
  ["Bookings", () => import("./(signed-in)/bookings/page.js"), {}],
  ["Booking detail", () => import("./(signed-in)/bookings/[id]/page.js"), { params: Promise.resolve({ id: "b1" }) }],
  ["Operations", () => import("./(signed-in)/operations/page.js"), {}],
  ["Invoices", () => import("./(signed-in)/invoices/page.js"), {}],
  ["Reports", () => import("./(signed-in)/reports/page.js"), { searchParams: Promise.resolve({}) }],
  ["Traffic", () => import("./(signed-in)/traffic/page.js"), { searchParams: Promise.resolve({ period: "30d" }) }],
  ["Customers", () => import("./(signed-in)/customers/page.js"), { searchParams: Promise.resolve({}) }],
  ["Customers — search", () => import("./(signed-in)/customers/page.js"), { searchParams: Promise.resolve({ q: "asha" }) }],
  ["Team", () => import("./(signed-in)/team/page.js"), {}],
  ["Trips", () => import("./(signed-in)/trips/page.js"), { searchParams: Promise.resolve({}) }],
  ["Trips — customized filter", () => import("./(signed-in)/trips/page.js"), { searchParams: Promise.resolve({ kind: "customized" }) }],
  // A coded group tour and a coded customized trip, both never edited — the
  // copy-on-write path, where the editor seeds itself from the catalogue.
  ["Trip editor — group", () => import("./(signed-in)/trips/[slug]/page.js"), { params: Promise.resolve({ slug: "kashmir-valley-escape" }) }],
  ["Trip editor — customized", () => import("./(signed-in)/trips/[slug]/page.js"), { params: Promise.resolve({ slug: "golden-triangle-classic" }) }],
  ["Pages", () => import("./(signed-in)/pages/page.js"), {}],
  ["Departures board", () => import("./(signed-in)/departures/page.js"), {}],
  ["Departure desk", () => import("./(signed-in)/departures/[slug]/[id]/page.js"), { params: Promise.resolve({ slug: "kashmir-valley-escape", id: "kve-1026" }) }],
  ["Traveller list", () => import("./(signed-in)/departures/[slug]/[id]/manifest/page.js"), { params: Promise.resolve({ slug: "kashmir-valley-escape", id: "kve-1026" }) }],
];

describe("every admin panel renders", () => {
  for (const [name, load, props] of PANELS) {
    it(name, async () => {
      const mod = await load();
      const Page = mod.default;
      expect(typeof Page).toBe("function");

      const element = await Page(props);
      // A server component returns an element tree. Anything else — undefined,
      // a thrown error, a redirect — means the page did not survive the request.
      expect(element).toBeTruthy();
      expect(typeof element).toBe("object");
    });
  }
});

describe("the panels built this session, with real data", () => {
  it("the lead detail page renders a lead carrying a full brief", async () => {
    // The brief fields are new columns; this is the first thing that would
    // break if a shape were wrong between the repository and the component.
    const { default: Page } = await import("./(signed-in)/leads/[id]/page.js");
    await expect(Page({ params: Promise.resolve({ id: "l1" }) })).resolves.toBeTruthy();
  });

  it("the lead detail page renders a lead with NO brief at all", async () => {
    // Every lead captured before this feature has brief: null, adults: null
    // and children: undefined. All of them still have to open.
    db.leads.push({
      id: "l_old", name: "Older enquiry", status: "new", notes: [], interests: [],
      receivedAt: new Date().toISOString(),
    });
    const { default: Page } = await import("./(signed-in)/leads/[id]/page.js");
    await expect(Page({ params: Promise.resolve({ id: "l_old" }) })).resolves.toBeTruthy();
  });

  it("the invoices desk renders with invoices and awaiting bookings", async () => {
    const { default: Page } = await import("./(signed-in)/invoices/page.js");
    await expect(Page({})).resolves.toBeTruthy();
  });

  it("the invoices desk renders when nothing has been invoiced yet", async () => {
    db.invoices.length = 0;
    const { default: Page } = await import("./(signed-in)/invoices/page.js");
    await expect(Page({})).resolves.toBeTruthy();
  });

  it("every LIST panel renders on an empty database", async () => {
    // A brand-new deployment has no rows anywhere, and empty states are
    // exactly where `.map` on undefined lives.
    //
    // Detail pages are excluded on purpose: with no rows, `/leads/l1` SHOULD
    // call notFound(). A 404 for a record that does not exist is correct
    // behaviour, not a failure to render.
    const DETAIL = new Set(["Lead detail", "Quotation detail", "Booking detail", "New quotation"]);
    for (const key of Object.keys(db)) db[key].length = 0;

    for (const [name, load, props] of PANELS) {
      if (DETAIL.has(name)) continue;
      const { default: Page } = await load();
      await expect(Page(props), `${name} on an empty database`).resolves.toBeTruthy();
    }
  });

  it("a detail page 404s for a record that does not exist", async () => {
    // The other half of the rule above, asserted rather than assumed.
    for (const key of Object.keys(db)) db[key].length = 0;
    const { default: Page } = await import("./(signed-in)/leads/[id]/page.js");
    await expect(Page({ params: Promise.resolve({ id: "ghost" }) })).rejects.toThrow(/notFound/);
  });
});
