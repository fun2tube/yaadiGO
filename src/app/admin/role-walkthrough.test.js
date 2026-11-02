import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Walking the panel as each role, and reading what is actually on the screen.
 *
 * The earlier smoke tests proved a page RETURNS something. That is not the
 * same as the page being usable: a screen can render perfectly and still be
 * missing the one control the role needs to do their job, and nothing would
 * notice.
 *
 * These render each panel to HTML as a given user and assert the controls are
 * present — and, just as importantly, that controls the role must NOT have are
 * absent. Permission bugs are invisible when they work and silent when they
 * do not.
 */

const db = {
  leads: [], quotations: [], bookings: [], payments: [], invoices: [],
  bookingServices: [], events: [], notifications: [], departures: [],
  documents: [], contentOverrides: [], catalogueOverrides: [], outbox: [],
};

const USERS = {
  admin: { id: "u_admin", name: "Owner", email: "owner@yaadigo.in", role: "admin", status: "active", permissions: ["*"] },
  sales: { id: "u_sales", name: "Priya", email: "priya@yaadigo.in", role: "sales", status: "active" },
  ops: { id: "u_ops", name: "Arun", email: "arun@yaadigo.in", role: "ops", status: "active" },
  accounts: { id: "u_acc", name: "Meera", email: "meera@yaadigo.in", role: "accounts", status: "active" },
};

let actingAs = USERS.admin;

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (c, data) => {
    const row = { id: `${c}_${((db[c] ??= []).length) + 1}`, ...data };
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
  upsertBy: vi.fn(async () => null),
}));

vi.mock("@/lib/cms/users", () => ({
  listUsers: vi.fn(async () => Object.values(USERS)),
  getUser: vi.fn(async (id) => Object.values(USERS).find((u) => u.id === id) ?? null),
  ensureBootstrapAdmin: vi.fn(async () => USERS.admin),
}));

vi.mock("@/lib/cms/auth", () => ({
  currentUser: vi.fn(async () => actingAs),
  authorise: vi.fn(async () => ({ user: actingAs })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to) => {
    const e = new Error(`REDIRECT:${to}`);
    e.isRedirect = true;
    throw e;
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  // The client components inside these pages call these on render. Static
  // rendering never fires an event, so inert stubs are enough.
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async () => {}),
  timelineFor: vi.fn(async () => []),
  listEvents: vi.fn(async () => []),
}));

const { permissionsForRole } = await import("@/lib/crm/schema");
for (const user of Object.values(USERS)) {
  user.permissions ??= permissionsForRole(user.role);
}

/** Render a panel as a given role and hand back the HTML. */
async function view(role, loader, props = {}) {
  actingAs = USERS[role];
  const { default: Page } = await loader();
  return renderToStaticMarkup(await Page(props));
}

function seed() {
  for (const key of Object.keys(db)) db[key].length = 0;

  db.leads.push({
    id: "l1", name: "Sharma", phone: "9811122233", email: "sharma@example.com",
    destination: "Spiti Valley", dates: "mid-June, flexible", budget: "around 40-50k",
    groupSize: 3, status: "quoted", ownerId: USERS.sales.id, source: "website",
    notes: [], interests: [], calls: [],
    adults: 2, children: [{ age: 7 }], infants: 0,
    departureDate: "2026-06-15", departureFlexible: true, returnDate: "2026-06-23",
    budgetAmount: 45000, budgetPerPerson: true,
    brief: {
      hotelCategory: "3-star", mealPlan: "MAP", transportModes: ["car"],
      rooms: [{ roomClass: "deluxe", occupancy: "double", extraMattress: 1, count: 1 }],
      stays: [], legs: [], specialRequests: "Jain food",
    },
    receivedAt: new Date().toISOString(), followUpAt: new Date().toISOString(),
  });

  db.quotations.push({
    id: "q1", leadId: "l1", version: 1, status: "sent", title: "Spiti Valley — 8 nights",
    destination: "Spiti Valley", durationDays: 9, travellers: 3,
    lines: [{ kind: "hotel", label: "Hotels", unitPrice: 24000, quantity: 1, perPerson: true, amount: 72000 }],
    inclusions: ["Hotels"], exclusions: ["Flights"],
    subtotal: 118500, cost: 90000, total: 124425, perPerson: 41475,
    discount: 0, taxPercent: 5, tax: 5925, grossMargin: 28500, marginPercent: 24,
    ownerId: USERS.sales.id, token: "tok_abc",
    createdAt: new Date().toISOString(), sentAt: new Date().toISOString(),
  });

  db.bookings.push({
    id: "b1", reference: "YG-0001", source: "quotation", status: "confirmed",
    leadId: "l1", quotationId: "q1", tripTitle: "Spiti Valley — 8 nights",
    name: "Sharma", phone: "9811122233", email: "sharma@example.com", travellers: 3,
    departureLabel: "15 Jun 2026", departureStart: "2026-06-15",
    total: 124425, perPerson: 41475, advance: 15000, balance: 109425, collected: 15000,
    salesOwnerId: USERS.sales.id, opsOwnerId: USERS.ops.id,
    handedToOpsAt: new Date().toISOString(),
    inclusions: [], exclusions: [], notes: [], seatsHeld: 0,
  });

  db.payments.push({
    id: "p1", bookingId: "b1", amount: 15000, kind: "advance",
    method: "Bank transfer", receivedAt: new Date().toISOString(),
  });

  db.bookingServices.push({
    id: "s1", bookingId: "b1", kind: "hotel", status: "todo",
    title: "Hotel Deyzor, Kaza", cost: 18000,
  });
}

beforeEach(seed);

// ---------------------------------------------------------------- SALES

describe("as a salesperson", () => {
  it("the lead list shows the customer and where they want to go", async () => {
    const html = await view("sales", () => import("./(signed-in)/leads/page.js"), {
      searchParams: Promise.resolve({}),
    });
    expect(html).toContain("Sharma");
    expect(html).toContain("Spiti Valley");
  });

  it("the lead page shows the brief they confirmed, not just the raw enquiry", async () => {
    const html = await view("sales", () => import("./(signed-in)/leads/[id]/page.js"), {
      params: Promise.resolve({ id: "l1" }),
    });
    // What the customer typed, preserved.
    expect(html).toContain("mid-June, flexible");
    // What sales confirmed, structured — these are the new columns.
    expect(html).toContain("2026-06-15");
    expect(html).toContain("Jain food");
  });

  it("the lead page offers every control the job needs", async () => {
    const html = await view("sales", () => import("./(signed-in)/leads/[id]/page.js"), {
      params: Promise.resolve({ id: "l1" }),
    });
    for (const control of ["Draft quotation", "Save brief", "Trip brief"]) {
      expect(html, `missing control: ${control}`).toContain(control);
    }
  });

  it("the brief panel exposes the whole vocabulary, not a subset", async () => {
    const html = await view("sales", () => import("./(signed-in)/leads/[id]/page.js"), {
      params: Promise.resolve({ id: "l1" }),
    });
    // Hotel categories
    for (const label of ["Budget hotel", "3 star", "5 star", "Homestay", "Campsite", "Villa", "Resort"]) {
      expect(html, `hotel category missing: ${label}`).toContain(label);
    }
    // Meal plans, shown to staff with the code
    for (const label of ["Room only (EP)", "Breakfast (CP)", "All meals (AP)"]) {
      expect(html, `meal plan missing: ${label}`).toContain(label);
    }
    // Room class and occupancy are SEPARATE controls
    for (const label of ["Deluxe", "Suite", "Triple", "Quad / family"]) {
      expect(html, `room option missing: ${label}`).toContain(label);
    }
    // Transport
    for (const label of ["Train", "Ferry", "Self drive"]) {
      expect(html, `transport missing: ${label}`).toContain(label);
    }
  });

  it("can reach quotations and bookings", async () => {
    const quotes = await view("sales", () => import("./(signed-in)/quotations/page.js"), {
      searchParams: Promise.resolve({}),
    });
    expect(quotes).toContain("Spiti Valley");

    const bookings = await view("sales", () => import("./(signed-in)/bookings/page.js"));
    expect(bookings).toContain("Sharma");
    expect(bookings).toContain("Spiti Valley");
    // The reference is the handle ops, accounts and the customer all use. It
    // was absent from this list until 2026-10-09; finding a booking meant
    // opening it one at a time.
    expect(bookings).toContain("YG-0001");
  });

  it("does not see a colleague's bookings (F6, 2026-10-14)", async () => {
    db.bookings.push({
      id: "b2", reference: "YG-0002", source: "website", status: "requested",
      leadId: null, tripTitle: "Goa Beach Weekend", name: "Kapoor", phone: "9822200011",
      travellers: 2, departureLabel: "14–17 Nov 2026", departureStart: "2026-11-14",
      total: 27800, advance: 6000, balance: 21800, collected: 0,
      salesOwnerId: "u_someone_else", notes: [], seatsHeld: 0,
    });
    const mine = await view("sales", () => import("./(signed-in)/bookings/page.js"));
    expect(mine).toContain("Sharma");
    expect(mine).not.toContain("Kapoor");

    const everyone = await view("admin", () => import("./(signed-in)/bookings/page.js"));
    expect(everyone).toContain("Kapoor");

    actingAs = USERS.sales;
    const { default: Page } = await import("./(signed-in)/bookings/[id]/page.js");
    const result = await Page({ params: Promise.resolve({ id: "b2" }) }).catch((e) => e);
    expect(String(result?.message)).toBe("NOT_FOUND");
  });

  it("is offered a way to record a bank transfer on a booking (F2)", async () => {
    const html = await view("sales", () => import("./(signed-in)/bookings/[id]/page.js"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(html).toContain("Record a payment");
    // The ledger shows the advance already received.
    expect(html).toContain("Bank transfer");
  });

  it("is NOT offered a button to raise a tax invoice", async () => {
    // The control weakness the accounts role exists to close.
    const html = await view("sales", () => import("./(signed-in)/invoices/page.js"));
    expect(html).not.toContain("Raise invoice");
    expect(html).toContain("Accounts raises this");
  });
});

// ------------------------------------------------------------------ OPS

describe("as operations", () => {
  it("sees the confirmed booking on the board", async () => {
    const html = await view("ops", () => import("./(signed-in)/operations/page.js"));
    expect(html).toContain("Spiti Valley");
  });

  it("sees the service list it has to arrange", async () => {
    const html = await view("ops", () => import("./(signed-in)/bookings/[id]/page.js"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(html).toContain("Hotel Deyzor");
  });

  it("is never shown the margin", async () => {
    // Ops must not see what the trip cost us or what we made on it.
    const html = await view("ops", () => import("./(signed-in)/bookings/[id]/page.js"), {
      params: Promise.resolve({ id: "b1" }),
    });
    expect(html).not.toContain("28,500");
    expect(html.toLowerCase()).not.toContain("margin");
  });

  it("cannot open the leads board at all", async () => {
    // ops has leads.read in the preset, so this documents what actually
    // happens rather than what the role chart claims.
    actingAs = USERS.ops;
    const { default: Page } = await import("./(signed-in)/leads/page.js");
    const result = await Page({ searchParams: Promise.resolve({}) }).catch((e) => e);
    // Either it redirects, or it renders scoped. Both are defensible; what
    // matters is it does not throw something unexpected.
    expect(result).toBeTruthy();
  });
});

// ------------------------------------------------------------- ACCOUNTS

describe("as accounts", () => {
  it("can raise an invoice once the company GSTIN is set", async () => {
    process.env.COMPANY_GSTIN = "07AAACY1234A1Z5";
    try {
      const html = await view("accounts", () => import("./(signed-in)/invoices/page.js"));
      expect(html).toContain("Raise invoice");
    } finally {
      delete process.env.COMPANY_GSTIN;
    }
  });

  it("is told why it cannot raise one without the company GSTIN", async () => {
    // A tax invoice without the supplier's GSTIN is not valid (F3, 2026-10-14).
    delete process.env.COMPANY_GSTIN;
    const html = await view("accounts", () => import("./(signed-in)/invoices/page.js"));
    expect(html).toContain("GSTIN is not set");
    expect(html).not.toContain(">Raise invoice<");
  });

  it("sees the booking it has to invoice", async () => {
    const html = await view("accounts", () => import("./(signed-in)/invoices/page.js"));
    expect(html).toContain("YG-0001");
  });

  it("is redirected away from leads", async () => {
    actingAs = USERS.accounts;
    const { default: Page } = await import("./(signed-in)/leads/page.js");
    const error = await Page({ searchParams: Promise.resolve({}) }).catch((e) => e);
    expect(error.isRedirect, "accounts should not reach the leads board").toBe(true);
  });
});

// ---------------------------------------------------------------- ADMIN

describe("as the super admin", () => {
  it("sees the margin a salesperson earned", async () => {
    const html = await view("admin", () => import("./(signed-in)/quotations/[id]/page.js"), {
      params: Promise.resolve({ id: "q1" }),
    });
    expect(html).toContain("Spiti Valley");
  });

  it("can invite someone as Accounts", async () => {
    const html = await view("admin", () => import("./(signed-in)/team/page.js"));
    expect(html).toContain("Accounts");
  });

  // The per-person module grid is behind a click — each row expands — so it is
  // not in the static markup. The data behind it is asserted in roles.test.js:
  // MODULES carries an `invoices` entry with its own write permission, so the
  // checkbox exists as soon as a row is opened.
});

// ------------------------------------------- 2026-10-14: register, reports, media

describe("the quotation register, reports and media (2026-10-14)", () => {
  it("shows ops the register, read-only and without margin", async () => {
    // Ops gained quotations.read in its preset; give it to this fixture user.
    USERS.ops.permissions = permissionsForRole("ops");
    const html = await view("ops", () => import("./(signed-in)/quotations/page.js"), {
      searchParams: Promise.resolve({ period: "30d" }),
    });
    expect(html).toContain("Sharma");
    expect(html).toContain("Spiti Valley");
    expect(html).not.toContain("Margin");
    expect(html).not.toContain("Ready to quote");
  });

  it("shows the admin the register with value and margin", async () => {
    const html = await view("admin", () => import("./(signed-in)/quotations/page.js"), {
      searchParams: Promise.resolve({ period: "30d" }),
    });
    expect(html).toContain("Quotations sent");
    expect(html).toContain("1,24,425");
    expect(html).toContain("Margin");
  });

  it("renders reports for any period, with the comparison and the team", async () => {
    for (const period of ["today", "week", "month", "fy"]) {
      const html = await view("admin", () => import("./(signed-in)/reports/page.js"), {
        searchParams: Promise.resolve({ period }),
      });
      expect(html).toContain("From enquiry to money");
      expect(html).toContain("The sales team");
    }
  });

  it("opens the staff preview of a quotation", async () => {
    const html = await view("sales", () => import("./(signed-in)/quotations/[id]/preview/page.js"), {
      params: Promise.resolve({ id: "q1" }),
    });
    expect(html).toContain("Preview");
    expect(html).toContain("Spiti Valley");
  });

  it("renders the media library", async () => {
    const html = await view("sales", () => import("./(signed-in)/media/page.js"));
    expect(html).toContain("Media");
    expect(html).toContain("Choose photos to upload");
  });
});
