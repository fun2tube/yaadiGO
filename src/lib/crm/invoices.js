import "server-only";

import { createRecord, getRecord, listRecords } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { getQuotation } from "@/lib/crm/quotations";
import { REGISTRATION, ADDRESS, CONTACT, ORG_LEGAL_NAME } from "@/lib/site";
import { emit } from "@/lib/crm/events";
import {
  TOUR_OPERATOR_SAC,
  splitTax,
  stateByCode,
  stateByName,
  stateOfGstin,
  validGstin,
} from "@/lib/crm/gst";

/**
 * Tax invoices.
 *
 * Three rules, all of them statutory rather than aesthetic:
 *
 *   NUMBERS ARE SEQUENTIAL AND GAPLESS, per financial year. `YG/26-27/0001`.
 *   A gap in an invoice sequence is a compliance question nobody wants to
 *   answer, so numbers are allocated at issue and never reserved in advance.
 *
 *   AN ISSUED INVOICE IS IMMUTABLE. A correction is a credit note, not an
 *   edit. Editing an issued invoice is the thing auditors look for.
 *
 *   IT SNAPSHOTS. Customer name, address, GSTIN, every line and the company's
 *   own details are copied at issue. A booking edited next month must not
 *   silently change an invoice already with the customer.
 *
 * Since 2026-10-14 (review 2026-10-14-full-function-test, F3) it also refuses
 * to issue without the supplier GSTIN, and states the SAC, the place of supply
 * and the CGST/SGST or IGST split — invoices before that carried none of them.
 *
 * HONEST LIMIT: this produces a correct-looking tax invoice. It is not an
 * accounting system, it files nothing, and GST returns still happen in Tally
 * or with a CA. The UI says so rather than implying otherwise.
 */

export const INVOICES = "invoices";
export const CREDIT_NOTES = "creditNotes";

/** Booking stages that can carry a tax invoice. A seat REQUEST cannot — nothing is sold yet. */
export const INVOICEABLE_STATUSES = ["confirmed", "part-paid", "paid", "in-progress", "completed"];

/**
 * The company GSTIN. `COMPANY_GSTIN` in the environment wins, so the owner can
 * set it on the host without a code change; otherwise REGISTRATION in site.js.
 */
export function sellerGstin() {
  const value = String(process.env.COMPANY_GSTIN || REGISTRATION?.gstin || "")
    .trim()
    .toUpperCase();
  return value || null;
}

/** Why invoices cannot be raised right now, or null. Shown on the desk before anyone tries. */
export function invoicingBlocker() {
  const gstin = sellerGstin();
  if (!gstin) {
    return "The company GSTIN is not set, and a tax invoice without the supplier's GSTIN is not valid. Set COMPANY_GSTIN on the host (or REGISTRATION.gstin in src/lib/site.js) and raising invoices switches on.";
  }
  if (!validGstin(gstin)) {
    return `The company GSTIN "${gstin}" does not look like a GSTIN (15 characters, starting with the state code). Correct it before raising invoices.`;
  }
  return null;
}

/** Indian financial year: April to March. 2026-09 → "26-27". */
function financialYear(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

/**
 * Next number in this financial year.
 *
 * Read-then-write, which under the file store is not atomic — two invoices
 * issued in the same instant could collide. On Postgres the unique index on
 * (financial_year, sequence) refuses the second one rather than duplicating
 * it. Bounded by reality: one desk, a handful of invoices a day.
 */
async function nextNumber(collection, prefix) {
  const fy = financialYear();
  const rows = await listRecords(collection);
  const thisYear = rows.filter((i) => i.financialYear === fy);
  const next = thisYear.reduce((max, i) => Math.max(max, Number(i.sequence) || 0), 0) + 1;
  return { number: `${prefix}/${fy}/${String(next).padStart(4, "0")}`, financialYear: fy, sequence: next };
}

export async function invoiceFor(bookingId) {
  const rows = await listRecords(INVOICES);
  return rows.find((i) => i.bookingId === bookingId) ?? null;
}

export async function listInvoices() {
  const rows = await listRecords(INVOICES);
  return rows.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
}

export async function getInvoice(id) {
  return getRecord(INVOICES, id);
}

/**
 * Credit notes live in their own table (migration 0005). Read softly: a
 * deploy that ran before the migration must still list invoices, so a missing
 * table is logged loudly and treated as "none yet". Issuing one still fails,
 * as it should.
 */
async function readCreditNotes() {
  try {
    return (await listRecords(CREDIT_NOTES)) ?? [];
  } catch (error) {
    console.error(
      "[invoices] could not read credit notes — has migration 0005 (credit_notes) been applied?",
      error?.message ?? error
    );
    return [];
  }
}

export async function creditNotesFor(invoiceId) {
  const rows = await readCreditNotes();
  return rows
    .filter((c) => c.invoiceId === invoiceId)
    .sort((a, b) => String(a.issuedAt).localeCompare(String(b.issuedAt)));
}

export async function listCreditNotes() {
  const rows = await readCreditNotes();
  return rows.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
}

/**
 * Issue an invoice for a booking.
 *
 * Idempotent: a second call returns the existing invoice rather than burning
 * a number. Duplicate invoices for one booking are a worse problem than none.
 */
export async function issueInvoice(
  bookingId,
  { actor, placeOfSupply, placeOfSupplyCode, customerGstin, customerAddress } = {}
) {
  const booking = await getRecord(BOOKINGS, bookingId);
  if (!booking) return { error: "No such booking." };

  const existing = await invoiceFor(bookingId);
  if (existing) return { invoice: existing, alreadyExisted: true };

  if (booking.status === "cancelled") {
    return { error: "This booking is cancelled." };
  }
  // F11: unconfirmed seat requests sat in the "awaiting an invoice" queue.
  // Nothing has been sold until the desk confirms.
  if (!INVOICEABLE_STATUSES.includes(booking.status)) {
    return { error: "Confirm the booking before invoicing it — nothing has been sold yet." };
  }

  // F3: a GST tax invoice without the supplier GSTIN is not a valid invoice.
  const blocker = invoicingBlocker();
  if (blocker) return { error: blocker };
  const gstin = sellerGstin();
  const sellerState = stateOfGstin(gstin);

  const buyerGstin = customerGstin?.trim().toUpperCase() || null;
  if (buyerGstin && !validGstin(buyerGstin)) {
    return {
      error: "The customer GSTIN does not look right — 15 characters, starting with the state code.",
    };
  }

  // Place of supply: given explicitly, else the registered buyer's state,
  // else the supplier's own state (an unregistered customer with no address
  // on record). Have the CA confirm the rule for this business.
  const place =
    stateByCode(placeOfSupplyCode) ??
    stateByName(placeOfSupply) ??
    stateOfGstin(buyerGstin) ??
    sellerState;

  // Lines come from the quotation where there is one; a fixed departure has no
  // quotation, so the trip itself is the single line.
  const quotation = booking.quotationId ? await getQuotation(booking.quotationId) : null;

  const lines = quotation?.lines?.length
    ? quotation.lines.map((line) => ({
        label: line.label,
        detail: line.detail ?? null,
        quantity: line.quantity,
        perPerson: line.perPerson,
        amount: line.amount,
      }))
    : [
        {
          label: booking.tripTitle,
          detail: `${booking.travellers} travellers · ${booking.departureLabel}`,
          quantity: 1,
          perPerson: false,
          amount: booking.total ?? 0,
        },
      ];

  const taxPercent = quotation?.taxPercent ?? 5;
  const total = booking.total ?? 0;
  const discount = quotation?.discount ?? 0;
  // A fixed departure's price is GST-inclusive, so its tax is backed out of
  // the total — an invoice reporting ₹0 tax on a taxable sale is wrong.
  const tax = quotation ? quotation.tax ?? 0 : Math.round(total - total / (1 + taxPercent / 100));
  const subtotal = quotation ? quotation.subtotal ?? total : total - tax;
  const taxSplit = splitTax(tax, sellerState?.code, place?.code);

  const { number, financialYear: fy, sequence } = await nextNumber(INVOICES, "YG");

  const invoice = await createRecord(INVOICES, {
    number,
    financialYear: fy,
    sequence,
    bookingId,
    leadId: booking.leadId ?? null,
    quotationId: booking.quotationId ?? null,

    // Snapshots. Everything below is frozen at issue.
    issuedAt: new Date().toISOString(),
    issuedById: actor?.id ?? null,
    issuedByName: actor?.name ?? null,

    seller: {
      // `REGISTRATION.legalName` and `.pan` have never existed on that object
      // — it holds only `cin` and `gstin`. So every invoice would have been
      // issued in the name "YaadiGo" rather than the registered entity, and
      // the seller's legal name is a statutory field on a tax invoice.
      name: ORG_LEGAL_NAME,
      gstin,
      state: sellerState?.name ?? null,
      stateCode: sellerState?.code ?? null,
      cin: REGISTRATION?.cin ?? null,
      address: ADDRESS ?? null,
      email: CONTACT?.email ?? null,
      phone: CONTACT?.phone ?? null,
    },
    customer: {
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      gstin: buyerGstin,
      address: customerAddress?.trim() || null,
    },
    placeOfSupply: place?.name ?? null,
    placeOfSupplyCode: place?.code ?? null,
    sac: TOUR_OPERATOR_SAC,
    taxSplit,

    title: booking.tripTitle,
    travellers: booking.travellers,
    travelDates: booking.departureLabel,
    lines,
    subtotal,
    discount,
    taxPercent,
    tax,
    total,
    currency: "INR",
  });

  await emit(
    "invoice.issued",
    {
      number,
      customerName: booking.name,
      customerEmail: booking.email,
      summary: `${number} · ₹${total.toLocaleString("en-IN")}`,
    },
    {
      leadId: booking.leadId,
      bookingId,
      ownerId: booking.salesOwnerId,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      amount: total,
    }
  );

  return { invoice };
}

/** What is still un-credited on an invoice. */
export async function creditableOn(invoice) {
  const notes = await creditNotesFor(invoice.id);
  const credited = notes.reduce((sum, c) => sum + (c.total ?? 0), 0);
  return { notes, credited, remaining: Math.max(0, (invoice.total ?? 0) - credited) };
}

/**
 * Issue a credit note against an invoice — the only way to correct one.
 *
 * `amount` is the GST-inclusive figure to credit (a refund, a price
 * correction, or the whole invoice to cancel it). The tax inside it is backed
 * out at the invoice's rate and split the same way the invoice was, so the
 * credit note reverses exactly the tax the invoice charged.
 */
export async function issueCreditNote(invoiceId, { amount, reason, actor } = {}) {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return { error: "No such invoice." };

  const why = String(reason ?? "").trim();
  if (why.length < 3) return { error: "Say why — a credit note without a reason is the first thing an auditor asks about." };

  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value <= 0) return { error: "Enter the amount to credit." };

  const { remaining } = await creditableOn(invoice);
  if (value > remaining) {
    return {
      error: `Only ₹${remaining.toLocaleString("en-IN")} of ${invoice.number} is left to credit.`,
    };
  }

  const taxPercent = invoice.taxPercent ?? 0;
  const tax = Math.round(value - value / (1 + taxPercent / 100));
  const taxable = value - tax;
  const taxSplit = splitTax(tax, invoice.seller?.stateCode, invoice.placeOfSupplyCode);

  const { number, financialYear: fy, sequence } = await nextNumber(CREDIT_NOTES, "YG/CN");

  const note = await createRecord(CREDIT_NOTES, {
    number,
    financialYear: fy,
    sequence,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    bookingId: invoice.bookingId ?? null,
    issuedAt: new Date().toISOString(),
    issuedById: actor?.id ?? null,
    issuedByName: actor?.name ?? null,
    reason: why,
    taxPercent,
    taxable,
    tax,
    total: value,
    taxSplit,
    currency: invoice.currency ?? "INR",
  });

  await emit(
    "invoice.credited",
    {
      number,
      invoiceNumber: invoice.number,
      customerName: invoice.customer?.name ?? null,
      summary: `${number} against ${invoice.number} · ₹${value.toLocaleString("en-IN")} · ${why}`,
    },
    {
      leadId: invoice.leadId ?? null,
      bookingId: invoice.bookingId ?? null,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
      amount: -value,
    }
  );

  return { creditNote: note };
}
