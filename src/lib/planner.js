import { z } from "zod";

// ---------------------------------------------------------------------------
// The shape of a generated itinerary.
//
// Field ORDER matters here. Structured outputs emit properties in schema
// order, and the streaming route relies on that: everything before `days`
// is the header (rendered immediately), `days` streams in one card at a
// time, and the trailing arrays close the document. Reordering this object
// changes what the user sees first — see lib/itinerary-stream.js.
// ---------------------------------------------------------------------------

export const DaySchema = z.object({
  day: z.number().int().describe("1-based day number"),
  title: z.string().describe("Short headline for the day, max ~8 words"),
  location: z.string().describe("Where the traveller is based this day"),
  morning: z.string().describe("What happens in the morning, 1-2 sentences"),
  afternoon: z.string().describe("What happens in the afternoon, 1-2 sentences"),
  evening: z.string().describe("What happens in the evening, 1-2 sentences"),
  stay: z.string().describe("Where they sleep — area and property type, not a brand name"),
  meals: z.string().describe("Notable food for the day; name real dishes or markets"),
  travelTime: z
    .string()
    .describe("Transfer time and mode for this day, or 'No long transfers' if none"),
  tips: z.array(z.string()).describe("1-3 specific, practical tips for this day"),
});

export const ItinerarySchema = z.object({
  title: z.string().describe("Evocative but plain title for the whole trip"),
  destination: z.string().describe("Normalised destination name"),
  durationDays: z.number().int(),
  summary: z.string().describe("2-3 sentences on the shape and pace of this trip"),
  bestTimeNote: z
    .string()
    .describe("Whether the requested dates are a good window, and what that means on the ground"),
  estimatedCostPerPerson: z.object({
    currency: z.literal("INR"),
    min: z.number().int(),
    max: z.number().int(),
    note: z.string().describe("What the range does and does not cover"),
  }),
  days: z.array(DaySchema),
  packing: z.array(z.string()).describe("4-7 items specific to this trip, not generic"),
  watchOuts: z
    .array(z.string())
    .describe("3-5 honest caveats: weather risk, permits, altitude, closures, scams"),
});

// ---------------------------------------------------------------------------
// Form options — shared by the client form and server-side validation so the
// two can never drift apart.
// ---------------------------------------------------------------------------

export const PACES = [
  { value: "relaxed", label: "Relaxed", detail: "Two nights minimum per base, late starts" },
  { value: "balanced", label: "Balanced", detail: "One main thing a day, room to breathe" },
  { value: "packed", label: "Packed", detail: "See as much as the daylight allows" },
];

export const TRAVEL_WITH = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family with kids" },
  { value: "friends", label: "Friends" },
  { value: "parents", label: "With parents" },
  { value: "colleagues", label: "Colleagues / offsite" },
];

export const BUDGET_BANDS = [
  { value: "shoestring", label: "Under ₹25,000", detail: "per person, excluding flights" },
  { value: "comfortable", label: "₹25,000 – ₹50,000", detail: "per person, excluding flights" },
  { value: "premium", label: "₹50,000 – ₹1,00,000", detail: "per person, excluding flights" },
  { value: "luxury", label: "Above ₹1,00,000", detail: "per person, excluding flights" },
];

export const INTERESTS = [
  "Adventure",
  "Relaxation",
  "Culture & heritage",
  "Food",
  "Nature & wildlife",
  "Pilgrimage",
  "Photography",
  "Nightlife",
  "Offbeat",
  "Shopping",
];

const PACE_VALUES = PACES.map((p) => p.value);
const TRAVEL_WITH_VALUES = TRAVEL_WITH.map((t) => t.value);
const BUDGET_VALUES = BUDGET_BANDS.map((b) => b.value);

/** What the client is allowed to ask for. Anything outside this is rejected. */
export const PlanRequestSchema = z.object({
  destination: z.string().trim().min(2).max(120),
  durationDays: z.number().int().min(1).max(21),
  month: z.string().trim().max(40).optional().or(z.literal("")),
  travellers: z.number().int().min(1).max(40),
  travelWith: z.enum(TRAVEL_WITH_VALUES),
  budget: z.enum(BUDGET_VALUES),
  pace: z.enum(PACE_VALUES),
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
});

function label(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}

/**
 * The system prompt. Kept deliberately opinionated: a planner that hedges
 * ("consider visiting a local restaurant") is worthless, and a planner that
 * invents hotel names and prices is worse than worthless for a real travel
 * agency that has to honour what the page said.
 */
export const SYSTEM_PROMPT = `You are the trip planning desk at YaadiGo, an Indian travel company that runs fixed-departure group tours, customized trips, and a corporate travel desk.

You write itineraries the way a good travel consultant does — specific, honest, and grounded in how the place actually works.

Rules you do not break:

1. BE SPECIFIC. Name real places, real neighbourhoods, real dishes, real viewpoints. "Visit a local market" is a failure; "Walk through Devaraja Market for the flower and incense stalls" is the standard.

2. NEVER INVENT COMMERCIAL DETAIL. Do not name specific hotels, guesthouses, tour operators, or restaurants as if you have booked them, and do not quote exact prices for them. Describe accommodation by area and type — "a heritage haveli inside the old city walls", "a mid-range riverside property in Old Manali". YaadiGo has to honour what this page says.

3. RESPECT THE CONSTRAINTS. The duration, pace, budget band and group type are hard constraints. A "relaxed" 5-day trip does not visit five cities. A family with young kids does not start with a 5am trek. A shoestring budget does not stay in boutique properties.

4. BE HONEST ABOUT RISK. If the requested month has monsoon, snow closures, permit requirements, altitude sickness risk, or peak-season crowds, say so plainly in bestTimeNote and watchOuts. Never oversell a bad window. If the destination is genuinely a poor idea in that month, say that and describe the trip that is still worth doing.

5. GEOGRAPHY IS REAL. Do not zig-zag. Account for actual transfer times in travelTime, including the bad ones — a 9-hour mountain drive is a 9-hour mountain drive, not "a scenic transfer".

6. COSTS ARE RANGES, LAND-ONLY. estimatedCostPerPerson excludes international and domestic flights unless the trip is impossible without a specific internal flight, in which case say so in the note. Stay inside the traveller's stated budget band, or state clearly in the note if the trip genuinely cannot be done for that.

Write in plain, warm, confident English. No exclamation marks, no brochure adjectives ("breathtaking", "nestled", "gem"), no emoji.`;

/** Turns a validated request into the user turn. */
export function buildPlanPrompt(input) {
  const lines = [
    `Destination: ${input.destination}`,
    `Duration: ${input.durationDays} days`,
    input.month ? `When: ${input.month}` : "When: dates not fixed yet",
    `Travellers: ${input.travellers} (${label(TRAVEL_WITH, input.travelWith)})`,
    `Budget: ${label(BUDGET_BANDS, input.budget)} per person, land-only`,
    `Pace: ${label(PACES, input.pace)} — ${PACES.find((p) => p.value === input.pace)?.detail}`,
    input.interests.length
      ? `Interests: ${input.interests.join(", ")}`
      : "Interests: not specified — assume a balanced first-time visit",
  ];

  if (input.notes) {
    lines.push(`Traveller's own notes: ${input.notes}`);
  }

  return `Plan this trip.\n\n${lines.join("\n")}\n\nProduce exactly ${input.durationDays} day entries, numbered 1 to ${input.durationDays}.`;
}

/** The user turn for regenerating a single day in place. */
export function buildDayPrompt({ input, itinerary, dayNumber, instruction }) {
  const neighbours = itinerary.days
    .filter((d) => Math.abs(d.day - dayNumber) === 1)
    .map((d) => `Day ${d.day} (${d.location}): ${d.title} — ${d.morning}`)
    .join("\n");

  return `Here is an itinerary you wrote:

Trip: ${itinerary.title} — ${itinerary.durationDays} days in ${itinerary.destination}
Travellers: ${input.travellers} (${label(TRAVEL_WITH, input.travelWith)})
Budget: ${label(BUDGET_BANDS, input.budget)} per person
Pace: ${label(PACES, input.pace)}

Rewrite DAY ${dayNumber} only.

${neighbours ? `The surrounding days, which do not change and must still connect geographically:\n${neighbours}\n` : ""}
The current day ${dayNumber} reads:
${JSON.stringify(itinerary.days.find((d) => d.day === dayNumber), null, 2)}

${instruction ? `What the traveller wants changed: ${instruction}` : "Give a genuinely different alternative for this day — a different angle on the same place, not a reshuffle of the same words."}

Return only the rewritten day ${dayNumber}. It must start and end in locations that connect to the surrounding days.`;
}
