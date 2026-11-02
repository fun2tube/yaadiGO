/**
 * The brochure blocks: packing list, galleries, route map, declaration.
 *
 * Kept in their own module rather than swelling quote-content.js, because the
 * declaration is long legal text that nobody should have to scroll past while
 * editing a payment schedule.
 *
 * Browser-safe: the quotation builder renders these in the admin.
 */

/**
 * What to pack, by the kind of trip.
 *
 * Trip-specific on purpose. A Spiti list and a Kerala list share almost
 * nothing, and a generic one is the list nobody reads twice — the traveller
 * who reaches Kaza without a power bank was failed by a checklist that tried
 * to cover every destination at once.
 */
export const PACKING_LISTS = {
  highAltitude: [
    "Backpack",
    "Photo ID (original)",
    "Personal medication",
    "Woollens and thermals",
    "Gloves and a warm cap",
    "Trek pants",
    "Trekking boots",
    "Extra socks",
    "Sunglasses",
    "Sunscreen",
    "Power bank",
    "LED torch",
    "Cash — ATMs are scarce",
    "Camera",
  ],
  beach: [
    "Backpack",
    "Photo ID (original)",
    "Personal medication",
    "Light cottons",
    "Swimwear",
    "Sandals and one pair of walking shoes",
    "Sunglasses",
    "Sunscreen — SPF 50",
    "Hat or cap",
    "Power bank",
    "Dry bag for wet things",
    "Camera",
  ],
  general: [
    "Backpack or cabin bag",
    "Photo ID (original)",
    "Personal medication",
    "Weather-appropriate clothing",
    "Comfortable walking shoes",
    "Sunglasses and sunscreen",
    "Power bank and charger",
    "Cash for small purchases",
  ],
};

/** Pick a list from the destination, falling back to the general one. */
export function packingFor(destination = "") {
  const where = String(destination).toLowerCase();
  if (/spiti|ladakh|kinnaur|kaza|leh|sikkim|bhutan|nepal|kashmir|himachal/.test(where)) {
    return PACKING_LISTS.highAltitude;
  }
  if (/goa|andaman|maldives|bali|beach|kerala|mauritius|phuket|thailand/.test(where)) {
    return PACKING_LISTS.beach;
  }
  return PACKING_LISTS.general;
}

/**
 * The declaration, from the company's own booking terms.
 *
 * Condensed from the brochure's eleven paragraphs into the clauses that
 * actually do work, in plain sentences. The original is a wall of text that
 * nobody reads, and an unread waiver protects nobody — a court looks at
 * whether the customer could reasonably have understood what they accepted.
 *
 * This is NOT legal advice and has not been reviewed by a lawyer. It restates
 * terms the business already publishes; before it goes to customers at scale,
 * someone qualified should check it.
 */
export const DEFAULT_DECLARATION = [
  "By confirming this booking you accept these terms on behalf of everyone travelling on it.",

  "This trip may visit remote or high-altitude areas where accommodation, transport, hygiene, medical facilities and connectivity are not of the standard found on a conventional holiday. You accept those conditions and confirm that everyone travelling is physically fit for the itinerary, and that any pre-existing medical condition has been declared to us at the time of booking.",

  "Where activities are run by independent operators — adventure activities, optional excursions, local guides — YaadiGo Networks Pvt Ltd arranges them but does not control them, and is not responsible for their safety standards or their performance.",

  "The itinerary may be changed, shortened or rerouted where weather, road conditions, permits or safety require it. We will always tell you and rebook what we can. Costs arising from events outside our reasonable control — weather, roadblocks, strikes, flight cancellations, civil disruption — are not refundable by us, though we will help you recover what is recoverable from airlines and insurers.",

  "Travel insurance is not included and is strongly recommended.",

  "Our tour leader's decision is final on any matter affecting the safety or wellbeing of the group. Behaviour that endangers, distresses or seriously inconveniences others may end that person's trip, without refund.",

  "Cancellation charges are as set out above. The advance booking amount is not refundable.",
];

/** The declaration as one block of text, which is how the template renders it. */
export function declarationText() {
  return DEFAULT_DECLARATION.join("\n\n");
}
