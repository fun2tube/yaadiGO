import "server-only";

import { createRecord, getRecord, listRecords } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { getQuotation } from "@/lib/crm/quotations";
import { REGISTRATION, ADDRESS, CONTACT, ORG_LEGAL_NAME } from "@/lib/site";
import { emit } from "@/lib/crm/events";

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
 * HONEST LIMIT: this produces a correct-looking tax invoice. It is not an
 * accounting system, it files nothing, and GST returns still happen in Tally
 * or with a CA. The UI says so rather than implying otherwise.
 */

export const INVOICES = "invoices";

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
 * issued in the same instant could collide. Bounded by reality (one desk,
 * a handful of invoices a day) and properly fixed by the Postgres move, where
 * this becomes a sequence. Flagged rather than hidden.
 */
async function nextNumber() {
  const fy = financialYear();
  const rows = await listRecords(INVOICES);
  const thisYear = rows.filter((i) => i.financialYear === fy);
  const next = thisYear.length + 1;
  return { number: `YG/${fy}/${String(next).padStart(4, "0")}`, financialYear: fy, sequence: next };
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
 * Issue an invoice for a booking.
 *
 * Idempotent: a second call returns the existing invoice rather than burning
 * a number. Duplicate invoices for one booking are a worse problem than none.
 */
export async function issueInvoice(bookingId, { actor, placeOfSupply, customerGstin } = {}) {
  const booking = await getRecord(BOOKINGS, bookingId);
  if (!booking) return { error: "No such booking." };

  const existing = await invoiceFor(bookingId);
  if (existing) return { invoice: existing, alreadyExisted: true };

  if (booking.status === "cancelled") {
    return { error: "This booking is cancelled." };
  }

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

  const subtotal = quotation?.subtotal ?? booking.total ?? 0;
  const discount = quotation?.discount ?? 0;
  const taxPercent = quotation?.taxPercent ?? 5;
  const tax = quotation?.tax ?? 0;
  const total = booking.total ?? 0;

  const { number, financialYear: fy, sequence } = await nextNumber();

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
      // the seller's legal name is a statutory field on a tax invoice. Found
      // when the accounts desk made this code reachable from the panel.
      name: ORG_LEGAL_NAME,
      gstin: REGISTRATION?.gstin ?? null,
      cin: REGISTRATION?.cin ?? null,
      address: ADDRESS ?? null,
      email: CONTACT?.email ?? null,
      phone: CONTACT?.phone ?? null,
    },
    customer: {
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      gstin: customerGstin?.trim() || null,
    },
    placeOfSupply: placeOfSupply?.trim() || null,

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
