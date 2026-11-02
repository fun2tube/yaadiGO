/**
 * The non-price content of a quotation.
 *
 * Defaults live here rather than in the builder so a salesperson in a hurry
 * still sends a complete document.
 *
 * NOTE, 2026-10-09: an earlier version of this comment claimed every one is
 * "editable per quotation". That is true of the SCHEMA — overrides are stored
 * in the quotation's `content` and the blocks render whatever they are given —
 * and false of the PRODUCT: `quote-builder.js` exposes no input for any of
 * them, so in practice these are policy set in code. Backlog #115 adds the
 * editing UI, #116 the named policy library. See
 * docs/design/team-operating-model.md §9.
 *
 * Safe to import from the browser: no server-only dependencies.
 */

import { packingFor, declarationText } from "@/lib/crm/quote-extras";

export const TEMPLATES = [
  {
    value: "simple",
    label: "Simple",
    blurb: "One page, price first. For a repeat customer or someone who has decided.",
    hero: false,
    dayImages: false,
    flights: false,
  },
  {
    value: "modern",
    label: "Modern",
    blurb: "Hero image and day cards. The everyday quotation.",
    hero: true,
    dayImages: false,
    flights: true,
  },
  {
    value: "detailed",
    label: "Detailed",
    blurb: "Everything — per-day images, hotels, flights, full policy. For big trips.",
    hero: true,
    dayImages: true,
    flights: true,
  },
];

export const TEMPLATE_VALUES = TEMPLATES.map((t) => t.value);

export function templateMeta(value) {
  return TEMPLATES.find((t) => t.value === value) ?? TEMPLATES[1];
}

/**
 * Payment schedule.
 *
 * The booking schedule YaadiGo actually uses.
 *
 * Taken from the company's own Spiti brochure, replacing invented percentages
 * that had been shipping as the default — a quotation carrying terms the
 * business never agreed to is a contract nobody can honour.
 *
 * The advance is a FLAT amount per person, not a percentage, which is why the
 * first row carries `amountPerPerson` instead of `percent`.
 */
export const DEFAULT_PAYMENT_SCHEDULE = [
  { label: "Advance to confirm your booking", amountPerPerson: 5000, when: "On acceptance" },
  { label: "50% of the package", percent: 50, when: "One month before departure" },
  { label: "Balance", percent: 50, when: "Seven days before departure" },
];

export function paymentSchedule(total, schedule = DEFAULT_PAYMENT_SCHEDULE, travellers = 1) {
  // Rounded to whole rupees, with the remainder pushed into the LAST row so
  // the instalments always sum back to the total. A schedule that adds up to
  // ₹3 less than the invoice is the kind of thing a customer notices and an
  // accountant cannot reconcile.
  const heads = Math.max(1, Number(travellers) || 1);

  // A flat per-person advance (ours is Rs 5,000 each) is not a percentage of
  // the total, and treating it as one would quote the wrong deposit on every
  // booking that is not exactly average.
  const rows = schedule.map((row) => ({
    ...row,
    amount: row.amountPerPerson
      ? Math.round(row.amountPerPerson * heads)
      : Math.round((Number(total) || 0) * ((row.percent ?? 0) / 100)),
  }));
  const drift = (Number(total) || 0) - rows.reduce((sum, r) => sum + r.amount, 0);
  if (rows.length > 0) rows[rows.length - 1].amount += drift;
  return rows;
}

export const DEFAULT_HOW_TO_BOOK = [
  "Tell us you are happy with this plan — reply here, or approve it at the link above.",
  "We confirm availability with the hotels and transport on your dates.",
  "Pay the advance below. Your booking is confirmed once we receive it.",
  "Vouchers, tickets and driver details reach you seven days before departure.",
];

/**
 * How the money can actually be sent.
 *
 * From the company brochure. Named options rather than one bank block, because
 * a customer who cannot use the first one needs to see the second without
 * asking — and asking is where a confirmed booking goes quiet for two days.
 */
export const DEFAULT_PAYMENT_OPTIONS = [
  {
    label: "Bank transfer",
    lines: [
      "Yaadigo Networks Pvt Ltd",
      "Account 201003067339 · Current",
      "IFSC INDB0000370 · Nehru Place",
    ],
  },
  {
    label: "Payment link",
    // Stated plainly: a fee discovered at the payment screen is the most
    // common reason an Indian checkout is abandoned.
    lines: ["We send a secure link.", "A 2.5% gateway charge applies."],
  },
  { label: "Google Pay", lines: ["73-73-73-4778"] },
];

/**
 * Cancellation terms.
 *
 * Deliberately concrete. "Cancellation charges as applicable" is the line that
 * causes the argument, because it means nothing until someone cancels and then
 * it means whatever the operator says.
 */
export const DEFAULT_CANCELLATION = [
  { window: "More than 30 days before departure", charge: "70% of the package rate" },
  { window: "29 to 8 days before departure", charge: "50% of the package rate" },
  { window: "Less than 7 days, or no-show", charge: "No refund" },
  { window: "The advance booking amount", charge: "Not refundable" },
  { window: "Flights", charge: "As per the airline's own policy" },
];

export const DEFAULT_TERMS = [
  "Prices hold until the validity date above and are subject to availability at the time of confirmation.",
  "Hotels named are indicative. If one is unavailable we substitute a property of the same or better standard and tell you before confirming.",
  "Airfare is not held until ticketed. A fare change between quotation and ticketing is passed on at cost, with your approval first.",
  "Government taxes, fuel surcharges and entry fees are as applicable on the date of travel.",
  "Please carry valid photo identification. International travel needs a passport valid for six months beyond your return date.",
  "We are not liable for delays or changes caused by weather, roadblocks, strikes or other events outside our control, but we will always rebook what we can.",
];

/** What the customer sees before the price — two or three lines, no adjectives. */
export function defaultOverview({ destination, durationDays, travellers }) {
  const parts = [];
  if (destination) parts.push(`${destination}`);
  if (durationDays) parts.push(`${durationDays} days`);
  if (travellers) parts.push(`${travellers} travellers`);
  return parts.length
    ? `${parts.join(" · ")}. Everything below is arranged by us — stays, transport and the day-by-day. Tell us what to change and we will rebuild it around your dates.`
    : "";
}

/** Seed a quotation's content block. */
export function defaultContent(quotation = {}) {
  return {
    template: "modern",
    heroImageId: null,
    overview: defaultOverview({
      destination: quotation.destination,
      durationDays: quotation.durationDays,
      travellers: quotation.travellers,
    }),
    hotels: [],
    flights: [],
    // The attractions block — what the customer will actually see, with a
    // photograph where we have one. Starts empty: a generic "visit the
    // beautiful valley" is worse than nothing, and the salesperson or the AI
    // draft fills it with the real stops on THIS trip.
    highlights: [],
    // Who is answerable for the trip. Filled from the quotation's owner when
    // it is rendered, so the customer has a name and a number rather than
    // "our support team".
    owner: null,
    paymentSchedule: DEFAULT_PAYMENT_SCHEDULE,
    paymentOptions: DEFAULT_PAYMENT_OPTIONS,
    howToBook: DEFAULT_HOW_TO_BOOK,
    cancellation: DEFAULT_CANCELLATION,
    // Brochure blocks. The packing list is chosen from the destination; the
    // galleries and map start empty because they need real photographs of
    // THIS trip, and a stock image of someone else is worse than none.
    thingsToCarry: packingFor(quotation.destination),
    stayPhotos: [],
    transportPhotos: [],
    routeMapId: null,
    routeMapUrl: null,
    declaration: declarationText(),
    termsList: DEFAULT_TERMS,
  };
}
