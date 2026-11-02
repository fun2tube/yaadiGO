import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";

/**
 * The whole chain, end to end.
 *
 * Enquiry → brief → quotation → send → approve → booking → payment →
 * operations → invoice. Every module in that sentence was individually
 * untested before this file; `convert.js` in particular is where an S1 shipped
 * (`actor is not defined`, so approving a quotation 500'd and never created a
 * booking) and nothing would have caught it.
 *
 * These are integration tests over real module code with the storage layer
 * stubbed. They assert the HANDOFFS — that money, ownership and identity
 * survive each step — because that is where this system has actually broken.
 */

const db = { leads: [], quotations: [], bookings: [], payments: [], invoices: [], bookingServices: [], events: [] };
const emitted = [];
let seq = 0;

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (collection, data) => {
    const row = { id: `${collection}_${++seq}`, createdAt: new Date().toISOString(), ...data };
    (db[collection] ??= []).push(row);
    return row;
  }),
  updateRecord: vi.fn(async (collection, id, patch) => {
    const row = (db[collection] ?? []).find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }),
  listRecords: vi.fn(async (collection) => db[collection] ?? []),
  getRecord: vi.fn(async (collection, id) => (db[collection] ?? []).find((r) => r.id === id) ?? null),
  upsertBy: vi.fn(async () => null),
}));

const STAFF = [
  { id: "u_sales", name: "Priya", role: "sales", status: "active" },
  { id: "u_ops", name: "Arun", role: "ops", status: "active" },
  { id: "u_acc", name: "Meera", role: "accounts", status: "active" },
];
vi.mock("@/lib/cms/users", () => ({ listUsers: vi.fn(async () => STAFF) }));

vi.mock("@/lib/crm/events", () => ({
  emit: vi.fn(async (type, payload, meta) => {
    emitted.push({ type, payload, meta });
  }),
  timelineFor: vi.fn(async () => []),
}));

const { captureLead, updateBrief, getLead } = await import("@/lib/crm/leads");
const { createQuotation, sendQuotation, decide, getQuotation, priceQuotation } = await import(
  "@/lib/crm/quotations"
);
const { convertQuotationToBooking, handToOperations } = await import("@/lib/crm/convert");
const { recordPayment, ledgerFor } = await import("@/lib/crm/payments");
const { addService, servicesFor, progressOf } = await import("@/lib/crm/operations");
const { issueInvoice, invoiceFor, issueCreditNote } = await import("@/lib/crm/invoices");

const SALES = STAFF[0];
const OPS = STAFF[1];
const ACCOUNTS = STAFF[2];

/** Two adults and a seven-year-old to Spiti — the shape of a real enquiry. */
const DRAFT = {
  title: "Spiti Valley — 8 nights",
  summary: "Shimla up, Manali down.",
  destination: "Spiti",
  durationDays: 9,
  travellers: 3,
  taxPercent: 5,
  discount: 0,
  lines: [
    { kind: "hotel", label: "Hotels, 8 nights", unitPrice: 24000, quantity: 1, perPerson: true, cost: 18000 },
    { kind: "transport", label: "Tempo traveller", unitPrice: 45000, quantity: 1, perPerson: false, cost: 36000 },
    { kind: "permit", label: "Inner line permits", unitPrice: 500, quantity: 1, perPerson: true, cost: 500 },
  ],
  inclusions: ["Hotels", "Transport", "Permits"],
  exclusions: ["Flights", "Lunches"],
};

beforeEach(() => {
  for (const key of Object.keys(db)) db[key].length = 0;
  emitted.length = 0;
  seq = 0;
});

async function walkToBooking() {
  const lead = await captureLead({
    name: "Sharma",
    phone: "9811122233",
    email: "sharma@example.com",
    destination: "Spiti",
    dates: "mid-June, flexible",
    budget: "around 40-50k",
    source: "website",
  });

  await updateBrief(lead.id, {
    departureDate: "2026-06-15",
    departureFlexible: true,
    adults: 2,
    children: [{ age: 7 }],
    brief: { hotelCategory: "3-star", mealPlan: "MAP", transportModes: ["car"] },
  }, { actor: SALES });

  const { quotation } = await createQuotation({ leadId: lead.id, draft: DRAFT, actor: SALES });
  await sendQuotation(quotation.id, { actor: SALES });
  await decide(quotation.id, "approved", { actor: SALES });
  const { booking } = await convertQuotationToBooking(quotation.id, { actor: SALES });
  return { lead, quotation, booking };
}

/**
 * Approved AND the advance received — what the desk has before it hands a
 * trip to operations or raises an invoice. Since 2026-10-14 an approval alone
 * leaves the booking "requested" (F8).
 */
async function walkToConfirmed() {
  const walked = await walkToBooking();
  await recordPayment({
    bookingId: walked.booking.id,
    amount: walked.booking.advance,
    method: "Bank transfer",
    kind: "advance",
    actor: SALES,
  });
  return walked;
}

describe("pricing", () => {
  it("multiplies per-person lines by the head count and total lines once", () => {
    const priced = priceQuotation({ lines: DRAFT.lines, travellers: 3, taxPercent: 5 });
    // (24000 + 500) x 3 + 45000 = 118500
    expect(priced.subtotal).toBe(118500);
    expect(priced.tax).toBe(Math.round(118500 * 0.05));
    expect(priced.total).toBe(118500 + priced.tax);
  });

  it("divides the total by heads, not by lines", () => {
    const priced = priceQuotation({ lines: DRAFT.lines, travellers: 3, taxPercent: 5 });
    expect(priced.perPerson).toBe(Math.round(priced.total / 3));
  });

  it("applies the discount before tax, never after", () => {
    // Tax is collected on what the customer actually pays. Taxing the
    // pre-discount figure overcharges on every discounted booking.
    const priced = priceQuotation({ lines: DRAFT.lines, travellers: 3, discount: 8500, taxPercent: 5 });
    expect(priced.tax).toBe(Math.round((118500 - 8500) * 0.05));
  });
});

describe("the lead → quotation handoff", () => {
  it("keeps the brief on the lead and the price on the quotation", async () => {
    const { lead, quotation } = await walkToBooking();
    const saved = await getLead(lead.id);
    expect(saved.brief.hotelCategory).toBe("3-star");
    expect(saved.departureDate).toBe("2026-06-15");
    expect(quotation.total).toBeGreaterThan(0);
  });

  it("attributes the quotation to the salesperson who built it", async () => {
    const { quotation } = await walkToBooking();
    expect(quotation.ownerId ?? quotation.createdById).toBe(SALES.id);
  });

  it("gives the customer a token link that is not the internal id", async () => {
    const { quotation } = await walkToBooking();
    expect(quotation.token).toBeTruthy();
    expect(quotation.token).not.toBe(quotation.id);
  });
});

describe("approval → booking", () => {
  it("creates a booking, with an actor — the S1 that shipped once", async () => {
    // `convertQuotationToBooking(id, { actor })` was called with a variable
    // named `user`, so approving a quotation threw ReferenceError and no
    // booking was ever made. This is that regression test.
    const { booking } = await walkToBooking();
    expect(booking).toBeTruthy();
    expect(booking.reference).toBeTruthy();
  });

  it("refuses to book a quotation nobody approved", async () => {
    const lead = await captureLead({ name: "X", phone: "9800000000", source: "website" });
    const { quotation } = await createQuotation({ leadId: lead.id, draft: DRAFT, actor: SALES });
    const result = await convertQuotationToBooking(quotation.id, { actor: SALES });
    expect(result.error).toBeTruthy();
    expect(db.bookings).toHaveLength(0);
  });

  it("is idempotent — a double click does not double-book", async () => {
    const { quotation } = await walkToBooking();
    const again = await convertQuotationToBooking(quotation.id, { actor: SALES });
    expect(again.alreadyExisted).toBe(true);
    expect(db.bookings).toHaveLength(1);
  });

  it("carries the money across unchanged", async () => {
    const { quotation, booking } = await walkToBooking();
    expect(booking.total).toBe(quotation.total);
    expect(booking.advance + booking.balance).toBe(booking.total);
  });

  it("keeps revenue with whoever owned the lead", async () => {
    const { booking } = await walkToBooking();
    expect(booking.salesOwnerId).toBe(SALES.id);
  });

  it("marks the lead converted so it leaves the open pipeline", async () => {
    const { lead, booking } = await walkToBooking();
    const saved = await getLead(lead.id);
    expect(saved.convertedAt).toBeTruthy();
    expect(saved.bookingId).toBe(booking.id);
  });
});

describe("payments", () => {
  it("moves the ledger and leaves the balance correct", async () => {
    const { booking } = await walkToBooking();
    const paid = await recordPayment({
      bookingId: booking.id,
      amount: booking.advance,
      method: "Bank transfer",
      kind: "advance",
      actor: SALES,
    });
    expect(paid.error).toBeFalsy();
    const ledger = await ledgerFor(booking.id);
    expect(ledger.collected).toBe(booking.advance);
    expect(ledger.outstanding).toBe(booking.total - booking.advance);
  });

  it("refuses an amount of zero rather than writing a meaningless row", async () => {
    const { booking } = await walkToBooking();
    const result = await recordPayment({ bookingId: booking.id, amount: 0, method: "Bank transfer" });
    expect(result.error).toBeTruthy();
    expect(db.payments).toHaveLength(0);
  });

  it("refuses a payment method it does not recognise", async () => {
    const { booking } = await walkToBooking();
    const result = await recordPayment({ bookingId: booking.id, amount: 5000, method: "Crypto" });
    expect(result.error).toBeTruthy();
  });

  it("treats a refund as money out", async () => {
    const { booking } = await walkToBooking();
    const inbound = await recordPayment({
      bookingId: booking.id,
      amount: 20000,
      method: "Bank transfer",
      actor: SALES,
    });
    expect(inbound.error).toBeFalsy();
    const refund = await recordPayment({
      bookingId: booking.id,
      amount: 5000,
      method: "Bank transfer",
      kind: "refund",
      actor: SALES,
    });
    expect(refund.error).toBeFalsy();
    const ledger = await ledgerFor(booking.id);
    expect(ledger.collected).toBe(15000);
  });
});

describe("the handoff to operations", () => {
  it("is explicit and timestamped, never automatic on payment", async () => {
    // Operations starts committing supplier money the moment they pick it up,
    // so a human presses the button.
    const { booking } = await walkToConfirmed();
    expect(booking.handedToOpsAt).toBeNull();

    const result = await handToOperations(booking.id, { actor: SALES, opsOwnerId: OPS.id });
    expect(result.booking.opsOwnerId).toBe(OPS.id);
    expect(result.booking.handedToOpsAt).toBeTruthy();
  });

  it("tracks the service list as operations builds it", async () => {
    const { booking } = await walkToConfirmed();
    await handToOperations(booking.id, { actor: SALES, opsOwnerId: OPS.id });

    const hotel = await addService(
      booking.id,
      { kind: "hotel", title: "Hotel Deyzor, Kaza", cost: 18000 },
      { actor: OPS }
    );
    const cab = await addService(
      booking.id,
      { kind: "cab", title: "Tempo traveller", cost: 36000 },
      { actor: OPS }
    );
    expect(hotel.error).toBeFalsy();
    expect(cab.error).toBeFalsy();

    const services = await servicesFor(booking.id);
    expect(services).toHaveLength(2);
    const progress = progressOf(services);
    expect(progress.total).toBe(2);
  });
});

describe("invoicing", () => {
  beforeAll(() => {
    process.env.COMPANY_GSTIN = "07AAACY1234A1Z5";
  });
  afterAll(() => {
    delete process.env.COMPANY_GSTIN;
  });

  it("issues against a booking, in the registered legal name", async () => {
    const { booking } = await walkToConfirmed();
    const { invoice } = await issueInvoice(booking.id, { actor: ACCOUNTS });

    expect(invoice.number).toBeTruthy();
    // `REGISTRATION.legalName` never existed, so this fell through to the
    // trading name "YaadiGo". The seller's registered name is a statutory
    // field on a GST invoice.
    expect(invoice.seller.name).toBe("YaadiGo Networks Pvt Ltd");
    expect(invoice.seller.name).not.toBe("YaadiGo");
  });

  it("takes its lines and total from the quotation, not from thin air", async () => {
    const { quotation, booking } = await walkToConfirmed();
    const { invoice } = await issueInvoice(booking.id, { actor: ACCOUNTS });
    expect(invoice.total).toBe(booking.total);
    expect(invoice.lines).toHaveLength(quotation.lines.length);
  });

  it("never issues twice for one booking", async () => {
    const { booking } = await walkToConfirmed();
    const first = await issueInvoice(booking.id, { actor: ACCOUNTS });
    const second = await issueInvoice(booking.id, { actor: ACCOUNTS });
    expect(second.alreadyExisted).toBe(true);
    expect(second.invoice.number).toBe(first.invoice.number);
    expect(db.invoices).toHaveLength(1);
  });

  it("numbers run in sequence", async () => {
    const a = await walkToConfirmed();
    const b = await walkToConfirmed();
    const one = await issueInvoice(a.booking.id, { actor: ACCOUNTS });
    const two = await issueInvoice(b.booking.id, { actor: ACCOUNTS });
    expect(two.invoice.sequence).toBe(one.invoice.sequence + 1);
    expect(two.invoice.number).not.toBe(one.invoice.number);
  });

  it("records who raised it", async () => {
    const { booking } = await walkToConfirmed();
    const { invoice } = await issueInvoice(booking.id, { actor: ACCOUNTS });
    expect(invoice.issuedById).toBe(ACCOUNTS.id);
    expect(invoice.issuedByName).toBe(ACCOUNTS.name);
  });

  it("finds the invoice back from the booking", async () => {
    const { booking } = await walkToConfirmed();
    await issueInvoice(booking.id, { actor: ACCOUNTS });
    expect(await invoiceFor(booking.id)).toBeTruthy();
  });
});

describe("the event log", () => {
  it("records every step, so a report never has to guess", async () => {
    const { booking } = await walkToBooking();
    await recordPayment({ bookingId: booking.id, amount: 10000, method: "Bank transfer", actor: SALES });

    const types = emitted.map((e) => e.type);
    expect(types).toContain("lead.created");
    expect(types).toContain("quotation.sent");
    expect(types).toContain("booking.created");
  });

  it("keeps the chain attached, so money traces back to its lead", async () => {
    const { lead, booking } = await walkToBooking();
    const created = emitted.find((e) => e.type === "booking.created");
    expect(created.meta.leadId).toBe(lead.id);
    expect(created.meta.bookingId).toBe(booking.id);
    expect(created.meta.ownerId).toBe(SALES.id);
  });
});

// ---------------------------------------------------------------------------
// Review 2026-10-14-full-function-test — the rules added to fix it
// ---------------------------------------------------------------------------

/** A seat request from the trip page, as createBookingRequest writes it. */
function seatRequest(leadId, overrides = {}) {
  const row = {
    id: `bookings_seat_${++seq}`,
    createdAt: new Date().toISOString(),
    reference: "YG26-SEAT1",
    source: "website",
    status: "requested",
    leadId,
    tripSlug: "kashmir-valley-escape",
    tripTitle: "Kashmir Valley Escape",
    departureId: "kve-1109",
    departureLabel: "9–15 Nov 2026",
    departureStart: "2026-11-09",
    travellers: 3,
    perPerson: 27000,
    total: 81000,
    advance: 15000,
    balance: 66000,
    collected: 0,
    salesOwnerId: SALES.id,
    notes: [],
    ...overrides,
  };
  db.bookings.push(row);
  return row;
}

async function approvedQuotationFor(leadId, draft = DRAFT) {
  const { quotation } = await createQuotation({ leadId, draft, actor: SALES });
  await sendQuotation(quotation.id, { actor: SALES });
  await decide(quotation.id, "approved", { actor: SALES });
  return getQuotation(quotation.id);
}

describe("one booking per lead (F1)", () => {
  it("approving a quote for a lead that requested seats updates that booking, not a second one", async () => {
    const lead = await captureLead({ name: "Mehra", phone: "9811100000", source: "fixed-departure-booking" });
    const request = seatRequest(lead.id);
    const quotation = await approvedQuotationFor(lead.id);

    const result = await convertQuotationToBooking(quotation.id, { actor: SALES });

    expect(result.linkedExisting).toBe(true);
    expect(db.bookings).toHaveLength(1);
    expect(result.booking.id).toBe(request.id);
    // Money from what the customer approved; the batch and seats stay.
    expect(result.booking.total).toBe(quotation.total);
    expect(result.booking.quotationId).toBe(quotation.id);
    expect(result.booking.departureId).toBe("kve-1109");
    expect(result.booking.status).toBe("requested");
    expect(emitted.map((e) => e.type)).toContain("booking.updated");
  });

  it("a second approved quotation on the same lead moves the one booking to the new total", async () => {
    const { lead, booking } = await walkToBooking();
    const second = await approvedQuotationFor(lead.id, { ...DRAFT, discount: 10000 });

    const result = await convertQuotationToBooking(second.id, { actor: SALES });

    expect(db.bookings).toHaveLength(1);
    expect(result.booking.id).toBe(booking.id);
    expect(result.booking.total).toBe(second.total);
  });

  it("a cancelled booking does not absorb a new approval", async () => {
    const lead = await captureLead({ name: "Rao", phone: "9811100001", source: "website" });
    seatRequest(lead.id, { status: "cancelled" });
    const quotation = await approvedQuotationFor(lead.id);
    const result = await convertQuotationToBooking(quotation.id, { actor: SALES });
    expect(result.linkedExisting).toBeFalsy();
    expect(db.bookings).toHaveLength(2);
  });
});

describe("approval is not confirmation (F8) and the advance has one rule (F7)", () => {
  it("a new quotation booking starts as requested", async () => {
    const { booking } = await walkToBooking();
    expect(booking.status).toBe("requested");
  });

  it("asks the advance the customer's page asks — 5,000 rupees a head by default", async () => {
    const { quotation, booking } = await walkToBooking();
    expect(booking.advance).toBe(5000 * quotation.travellers);
    expect(booking.advance + booking.balance).toBe(booking.total);
  });

  it("refuses the handover until the booking is confirmed or paid", async () => {
    const { booking } = await walkToBooking();
    const result = await handToOperations(booking.id, { actor: SALES });
    expect(result.error).toBeTruthy();
  });
});

describe("recording money against seats (F2)", () => {
  it("refuses a manual payment on an unconfirmed seat request — confirming takes the seats", async () => {
    const lead = await captureLead({ name: "Bose", phone: "9811100002", source: "website" });
    const request = seatRequest(lead.id);
    const result = await recordPayment({ bookingId: request.id, amount: 15000, method: "UPI", actor: SALES });
    expect(result.error).toMatch(/Confirm this booking first/);
    expect(db.payments).toHaveLength(0);
  });

  it("records a gateway payment anyway, without moving the booking into a seat-holding stage", async () => {
    const lead = await captureLead({ name: "Iyer", phone: "9811100003", source: "website" });
    const request = seatRequest(lead.id);
    const result = await recordPayment({
      bookingId: request.id,
      amount: 15000,
      method: "UPI",
      fromGateway: true,
      allowOverpayment: true,
    });
    expect(result.error).toBeFalsy();
    expect(result.booking.collected).toBe(15000);
    expect(result.booking.status).toBe("requested");
  });

  it("takes money on a quotation booking — no seats involved — and moves it to part-paid", async () => {
    const { booking } = await walkToBooking();
    const result = await recordPayment({ bookingId: booking.id, amount: booking.advance, method: "UPI", actor: SALES });
    expect(result.booking.status).toBe("part-paid");
  });

  it("a refund on a cancelled booking leaves it cancelled", async () => {
    const { booking } = await walkToConfirmed();
    booking.status = "cancelled";
    const result = await recordPayment({
      bookingId: booking.id,
      amount: 1000,
      kind: "refund",
      method: "Bank transfer",
      actor: SALES,
    });
    expect(result.booking.status).toBe("cancelled");
  });
});

describe("GST invoices (F3, F11)", () => {
  afterEach(() => {
    delete process.env.COMPANY_GSTIN;
  });

  it("refuses to issue without the company GSTIN", async () => {
    delete process.env.COMPANY_GSTIN;
    const { booking } = await walkToConfirmed();
    const result = await issueInvoice(booking.id, { actor: ACCOUNTS });
    expect(result.error).toMatch(/GSTIN/);
    expect(db.invoices).toHaveLength(0);
  });

  it("refuses an unconfirmed booking", async () => {
    process.env.COMPANY_GSTIN = "07AAACY1234A1Z5";
    const { booking } = await walkToBooking();
    const result = await issueInvoice(booking.id, { actor: ACCOUNTS });
    expect(result.error).toMatch(/Confirm/);
  });

  it("states SAC, place of supply and CGST/SGST inside Delhi", async () => {
    process.env.COMPANY_GSTIN = "07AAACY1234A1Z5";
    const { booking } = await walkToConfirmed();
    const { invoice } = await issueInvoice(booking.id, { actor: ACCOUNTS });
    expect(invoice.sac).toBe("998555");
    expect(invoice.seller.gstin).toBe("07AAACY1234A1Z5");
    expect(invoice.placeOfSupply).toBe("Delhi");
    expect(invoice.taxSplit.kind).toBe("cgst-sgst");
    expect(invoice.taxSplit.cgst + invoice.taxSplit.sgst).toBe(invoice.tax);
  });

  it("charges IGST to a customer registered in another state", async () => {
    process.env.COMPANY_GSTIN = "07AAACY1234A1Z5";
    const { booking } = await walkToConfirmed();
    const { invoice } = await issueInvoice(booking.id, {
      actor: ACCOUNTS,
      customerGstin: "27AAACB1234C1Z9",
    });
    expect(invoice.placeOfSupplyCode).toBe("27");
    expect(invoice.taxSplit).toMatchObject({ kind: "igst", igst: invoice.tax });
  });

  it("rejects a malformed customer GSTIN", async () => {
    process.env.COMPANY_GSTIN = "07AAACY1234A1Z5";
    const { booking } = await walkToConfirmed();
    const result = await issueInvoice(booking.id, { actor: ACCOUNTS, customerGstin: "NOT-A-GSTIN" });
    expect(result.error).toMatch(/customer GSTIN/);
  });
});

describe("credit notes", () => {
  beforeEach(() => {
    process.env.COMPANY_GSTIN = "07AAACY1234A1Z5";
  });
  afterEach(() => {
    delete process.env.COMPANY_GSTIN;
  });

  async function invoiced() {
    const { booking } = await walkToConfirmed();
    const { invoice } = await issueInvoice(booking.id, { actor: ACCOUNTS });
    return invoice;
  }

  it("issues against an invoice with its own sequence and backs the tax out", async () => {
    const invoice = await invoiced();
    const { creditNote } = await issueCreditNote(invoice.id, {
      amount: 10500,
      reason: "One traveller dropped out",
      actor: ACCOUNTS,
    });
    expect(creditNote.number).toMatch(/^YG\/CN\/\d\d-\d\d\/0001$/);
    expect(creditNote.tax).toBe(500);
    expect(creditNote.taxable).toBe(10000);
    expect(creditNote.taxSplit.kind).toBe("cgst-sgst");
  });

  it("never credits more than the invoice has left", async () => {
    const invoice = await invoiced();
    await issueCreditNote(invoice.id, { amount: invoice.total - 100, reason: "Price corrected", actor: ACCOUNTS });
    const over = await issueCreditNote(invoice.id, { amount: 101, reason: "Again", actor: ACCOUNTS });
    expect(over.error).toMatch(/left to credit/);
  });

  it("requires a reason", async () => {
    const invoice = await invoiced();
    const result = await issueCreditNote(invoice.id, { amount: 100, reason: " ", actor: ACCOUNTS });
    expect(result.error).toBeTruthy();
  });
});

describe("a quotation never moves seats on its own", () => {
  it("keeps the seat count of a confirmed seat request and tells the desk when the quote differs", async () => {
    const lead = await captureLead({ name: "Nair", phone: "9811100004", source: "website" });
    const request = seatRequest(lead.id, { status: "confirmed", travellers: 2, seatsHeld: 2 });
    // DRAFT is for 3 travellers.
    const quotation = await approvedQuotationFor(lead.id);

    const result = await convertQuotationToBooking(quotation.id, { actor: SALES });

    expect(result.booking.id).toBe(request.id);
    expect(result.booking.travellers).toBe(2);
    expect(result.booking.notes.at(-1).body).toMatch(/Seats were not changed/);
  });
});
