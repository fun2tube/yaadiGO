import "server-only";

import { z } from "zod";
import { getProvider, PlannerUnavailableError } from "@/lib/ai";
import { QUOTE_LINE_KIND_VALUES } from "@/lib/crm/schema";
import { buildPricingContext, renderPricingContext } from "@/lib/crm/pricing-context";
import {
  normaliseBrief,
  briefGaps,
  travellerSummary,
  seatedTravellers,
  childBand,
  hotelCategoryLabel,
  mealPlanLabel,
  roomClassLabel,
  occupancyLabel,
  transportLabel,
} from "@/lib/crm/brief";

/**
 * The two-minute quotation.
 *
 * The slow part of quoting is not typing. It is deciding what goes in, at what
 * price, and writing inclusions precise enough that nobody rings back asking
 * whether flights are covered. This drafts all of that from what the lead
 * already told us, including the itinerary the AI planner produced.
 *
 * Three things separate this from a chatbot that writes a nice-looking quote:
 *
 *   IT IS GROUNDED. The model is handed what this business actually charges
 *   for comparable trips before it prices anything. Ungrounded, it invents a
 *   number from training data — plausible, years stale, and inconsistent with
 *   the price the same customer just read on the website.
 *
 *   IT DECLARES ITS OWN UNCERTAINTY. Every line is marked known / estimate /
 *   placeholder, and the builder highlights the last two. A draft that
 *   presents a guessed hotel rate as settled fact is worse than a blank form,
 *   because a salesperson skim-reading a confident number will send it.
 *
 *   IT COSTS AS WELL AS PRICES. Each line carries an estimated supplier cost,
 *   so the desk sees margin before discounting rather than after.
 *
 * It DRAFTS. Nothing here is sent. A human edits and sends, because these are
 * real prices a real business has to honour.
 */

const LineSchema = z.object({
  kind: z.enum(QUOTE_LINE_KIND_VALUES),
  label: z.string().min(3).max(160),
  detail: z.string().max(300).optional(),
  // The description is load-bearing. Gemini reads it, and without it the model
  // puts the TRAVELLER COUNT here — which, on a perPerson line, the pricer then
  // multiplies by the traveller count again. See the guard in draftQuotation.
  quantity: z
    .number()
    .int()
    .min(1)
    .max(60)
    .describe(
      "Units of this line, NEVER the number of travellers. Nights for a hotel, trips for a transfer, 1 for a single ticket or permit. The system already knows how many people are travelling and multiplies perPerson lines itself."
    ),
  unitPrice: z.number().min(0).max(10000000),
  // What we expect to pay the supplier for this line. Lets the builder show
  // margin live, which is the number that decides whether a discount is
  // affordable. 0 means "no idea" rather than "free".
  unitCost: z.number().min(0).max(10000000),
  perPerson: z.boolean(),
  confidence: z.enum(["known", "estimate", "placeholder"]),
});

/**
 * A day on the quotation.
 *
 * Field names match what `components/quote/blocks.js` already renders, and the
 * planner's own DaySchema, so one shape travels from the public planner through
 * the quotation to the PDF.
 *
 * Why this is on the quotation at all: a priced trip with no day-by-day is a
 * price list, and a price list does not sell a holiday. A lead that arrives
 * from the AI planner brings its itinerary with it — but one that arrives from
 * the contact form, from Yaadi or over the phone brings nothing, and those are
 * the majority. Without this, those quotations print as a table of money.
 */
const QuoteDaySchema = z.object({
  day: z.number().int().min(1).max(30).describe("1-based day number"),
  title: z.string().max(90).describe("Short headline for the day, max ~8 words"),
  summary: z.string().max(240).describe("One sentence on the shape of the day"),
  morning: z.string().max(240),
  afternoon: z.string().max(240),
  evening: z.string().max(240),
});

export const QuoteDraftSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(20).max(600),
  durationDays: z.number().int().min(1).max(30),
  days: z
    .array(QuoteDaySchema)
    .max(30)
    .describe("The day-by-day plan. One entry per day of durationDays."),
  lines: z.array(LineSchema).min(3).max(25),
  inclusions: z.array(z.string().max(200)).min(3).max(20),
  exclusions: z.array(z.string().max(200)).min(2).max(15),
  assumptions: z.array(z.string().max(240)).max(10),
  // The question that most often unblocks a stalled quotation. One, not five.
  clarifyingQuestion: z.string().max(240).optional(),
});

const SYSTEM = `You draft travel quotations for YaadiGo, an Indian tour operator. A salesperson reviews and corrects everything you produce, then sends it under the company's name to a real customer who will hold the company to it.

## What you are doing

Turn an enquiry into a priced draft: the line items the trip is made of, what each costs us, the inclusions, the exclusions, and a short summary the customer reads first.

## Pricing

Price in INR for the Indian market, for Indian travellers, at today's rates.

You will usually be given what this company already charges for comparable trips. That is your anchor. Price consistently with it. A quotation far outside that range without a reason stated in assumptions is wrong — the customer has often already seen those prices on the website, and an inconsistent quote reads as either a mistake or an attempt to overcharge.

For every line give BOTH:
- unitPrice — what the customer pays
- unitCost — what we expect to pay the supplier

A sensible gross margin on Indian packages is 12–20% overall. Do not build the margin into a separate line; put it in the spread between cost and price on each line.

Mark every line honestly:
- "known" — a standard, stable rate you are confident about (monument entry fees, typical intercity cab rates, permit costs)
- "estimate" — a realistic market rate that moves with date and availability (hotels, flights, houseboats)
- "placeholder" — you genuinely do not know; put a round number and say so in assumptions

Never mark a line "known" to look more useful. The salesperson checks the estimates and placeholders first, so a mislabelled line is exactly how a wrong price reaches a customer.

## Lines

Cover the whole trip: accommodation, internal transport, airport transfers, activities that have a real entry cost, meals where included, a guide where it is normal, permits where they are required.

perPerson: true for anything charged per head — rooms priced per person sharing, activity tickets, meals, flights.
perPerson: false for anything charged once for the group — a cab for the day, a guide, one permit, one houseboat.

Getting this backwards multiplies a group cost by the headcount. It is the single most expensive mistake in a quotation: a ₹12,000 car becomes ₹48,000 for four people and the quote is dead on arrival.

quantity is the NUMBER OF UNITS of that line. It is never the number of travellers. The system already knows the headcount and multiplies perPerson lines by it on its own, so putting the headcount in quantity charges the customer twice.

For 2 travellers on a 5-day trip:
- 4 nights in a hotel at ₹8,000 per person per night → quantity 4, unitPrice 8000, perPerson true. (= ₹64,000)
- One UAE visa each at ₹7,500 → quantity 1, unitPrice 7500, perPerson true. (= ₹15,000)
- One airport transfer for the pair at ₹4,500 → quantity 1, unitPrice 4500, perPerson false. (= ₹4,500)
- A desert safari ticket each at ₹4,200 → quantity 1, unitPrice 4200, perPerson true. (= ₹8,400)

Writing quantity 2 on any of those perPerson lines because there are two travellers would double the price of the whole quotation.

## The day-by-day

Write one entry per day of the trip, named places only — real towns, real sights, real transfers. A customer reads the plan before the price, and a vague day ("explore the city at leisure") is why a quotation gets ignored.

If the enquiry already came with an itinerary, follow it rather than inventing a different one. The price must describe the same trip as the plan.

## Inclusions and exclusions

Write them as the customer reads them: specific, plain, complete enough to prevent an argument later. "7 nights in 3-star hotels with breakfast" — not "accommodation".

Flights, visas, travel insurance, personal expenses, early check-in and anything seasonal belong in exclusions unless the enquiry says otherwise. If a monument is closed on a particular weekday, say so.

## Assumptions

State what you had to assume: dates, star rating, room sharing, departure city, whether flights are included. This is where uncertainty goes. It must never go into a confident price.

## The clarifying question

If one missing fact would materially change the price — exact dates, departure city, room sharing, flights or land-only — ask it as a single short question. One question a salesperson can put in a WhatsApp message. Omit it if you genuinely have enough.

## Voice

Plain, warm, specific. No brochure adjectives: nothing is "breathtaking", "nestled", "a hidden gem" or "a paradise on earth". No exclamation marks, no emoji. Write like a colleague who has been there, not a brochure.`;

/**
 * The confirmed brief, as prompt text.
 *
 * This is the half of the enquiry the salesperson established on the phone,
 * and until now the model never saw any of it. It was told "Travellers: 4,
 * Dates: mid-June" and left to assume the hotel standard, the meal plan, the
 * room split and how anyone got between cities. Four assumptions, every one
 * of them priced.
 *
 * Decided facts are marked as decided so the model does not re-assume them;
 * anything still blank is named, so its assumption is at least an informed
 * one and lands in the assumptions list where a salesperson will see it.
 */
function describeBrief(lead) {
  const brief = normaliseBrief(lead.brief);
  const lines = [];

  const pax = travellerSummary(lead);
  if (pax) {
    lines.push(`Party: ${pax}`);
    // Child ages are the commonest cause of a wrong hotel price in India, so
    // they are called out rather than buried in the party string.
    const kids = Array.isArray(lead.children) ? lead.children : [];
    if (kids.length) {
      lines.push(
        `Child ages: ${kids
          .map((c) => `${c.age} (${childBand(c.age)?.label ?? "age not given"})`)
          .join("; ")}. Price children against the property's own child policy, not as adults.`
      );
    }
    if (Number(lead.infants) > 0) lines.push("Infants travel on a lap and take no vehicle seat.");
  }

  if (lead.departureDate) {
    lines.push(
      `Departure: ${lead.departureDate}${lead.returnDate ? ` returning ${lead.returnDate}` : ""}${
        lead.departureFlexible
          ? " - dates are FLEXIBLE, so a cheaper nearby date is worth suggesting"
          : " - dates are FIXED"
      }`
    );
  }

  if (brief.hotelCategory) {
    lines.push(
      `Hotel category: ${hotelCategoryLabel(brief.hotelCategory)} - decided, do not assume otherwise.`
    );
  }
  if (brief.mealPlan) {
    lines.push(`Meal plan: ${mealPlanLabel(brief.mealPlan)} - decided. Price exactly this plan.`);
  }

  if (brief.rooms?.length) {
    lines.push(
      `Rooms: ${brief.rooms
        .map(
          (r) =>
            `${r.count} x ${roomClassLabel(r.roomClass)} at ${occupancyLabel(r.occupancy)} occupancy${
              r.extraMattress ? ` with ${r.extraMattress} extra mattress` : ""
            }`
        )
        .join("; ")}. This is the room split the customer agreed; do not re-split the party.`
    );
  }

  if (brief.transportModes?.length) {
    lines.push(`Transport: ${brief.transportModes.map(transportLabel).join(" + ")} - decided.`);
  }

  if (brief.stays?.length) {
    lines.push(
      "Stays, in order:",
      ...brief.stays.map(
        (st) =>
          `  ${st.city} - ${st.nights} night(s)${
            st.hotelCategory ? `, ${hotelCategoryLabel(st.hotelCategory)}` : ""
          }${st.mealPlan ? `, ${mealPlanLabel(st.mealPlan)}` : ""}${st.note ? ` (${st.note})` : ""}`
      )
    );
  }

  if (brief.legs?.length) {
    lines.push(
      "Transfers:",
      ...brief.legs.map(
        (l) =>
          `  ${l.from || "?"} to ${l.to || "?"} by ${transportLabel(l.mode)}${
            l.note ? ` (${l.note})` : ""
          }`
      )
    );
  }

  if (brief.specialRequests?.trim()) {
    lines.push(`Special requests (honour them or price them): ${brief.specialRequests.trim()}`);
  }

  if (lead.budgetAmount) {
    lines.push(
      `Confirmed budget: Rs ${Number(lead.budgetAmount).toLocaleString("en-IN")} ${
        lead.budgetPerPerson === false ? "for the whole group" : "per person"
      }. Land near it or explain the gap.`
    );
  }

  const gaps = briefGaps(lead);
  if (gaps.length) {
    lines.push(
      `Still unconfirmed: ${gaps.join(", ")}. Assume sensibly and SAY SO in your assumptions.`
    );
  }

  return lines.length
    ? ["", "## What the salesperson confirmed on the call", ...lines].join("\n")
    : "";
}


function describeLead(lead, itinerary) {
  const lines = [
    "## The enquiry",
    `Destination: ${lead.destination ?? "not stated"}`,
    // The structured head count wins when it exists: `groupSize` is whatever
    // the website form collected and cannot tell an adult from a 4-year-old.
    `Travellers: ${travellerSummary(lead) || lead.groupSize || "not stated"}`,
    `Dates: ${lead.departureDate ?? lead.dates ?? "not stated"}`,
    `Budget band: ${lead.budget ?? "not stated"}`,
    lead.interests?.length ? `Interests: ${lead.interests.join(", ")}` : null,
    lead.company ? `This is a CORPORATE enquiry from ${lead.company}. Invoicing and GST matter; leisure extras do not.` : null,
    lead.message ? `\nWhat they wrote:\n${lead.message}` : null,
    describeBrief(lead) || null,
  ].filter(Boolean);

  if (itinerary?.days?.length) {
    lines.push(
      "",
      "## They have already seen this itinerary from our AI planner",
      "Quote against it. Keep the same shape, the same places and the same number of days — they have read it and will compare.",
      `Title: ${itinerary.title}`,
      `Duration: ${itinerary.durationDays} days`,
      itinerary.estimatedCostPerPerson
        ? `We showed them an indicative ₹${itinerary.estimatedCostPerPerson.min?.toLocaleString(
            "en-IN"
          )}–${itinerary.estimatedCostPerPerson.max?.toLocaleString(
            "en-IN"
          )} per person. Do not land far outside that without saying why.`
        : null,
      ...itinerary.days.map(
        (day) =>
          `Day ${day.day}: ${day.title} — ${[day.morning, day.afternoon, day.evening]
            .filter(Boolean)
            .join(" / ")
            .slice(0, 260)}`
      )
    );
  }

  return lines.filter(Boolean).join("\n");
}

/**
 * Draft a quotation for a lead.
 *
 * Returns { draft } or { error }. Never throws for a model problem — the
 * builder has to stay usable by hand when the AI is unavailable, which is the
 * whole reason the manual editor exists alongside it.
 */
/**
 * Catch the double-count before a salesperson sees the number.
 *
 * `priceQuotation` multiplies a perPerson line by `quantity × travellers`. So a
 * line that says "quantity 2, perPerson true" for a party of 2 is charged four
 * times, and the whole quotation comes out at roughly double. That is exactly
 * what the model produced before `quantity` was documented — a 5-day Dubai trip
 * for two priced at ₹2,05,800 when the lines summed to ₹1,00,500.
 *
 * Deliberately FLAGS rather than corrects. The suspicious case — perPerson with
 * quantity equal to the headcount — is usually the mistake but can be
 * legitimate: two nights for two people is a real line. **Silently halving a
 * price is as dangerous as silently doubling it**, and this is a draft a human
 * reviews before anything is sent. So it is demoted to "placeholder", which is
 * the confidence level the builder shows first, and said out loud in
 * assumptions.
 */
function flagDoubleCountedLines(draft, groupSize) {
  const heads = Math.max(1, Number(groupSize) || 0);
  if (heads < 2) return draft;

  const suspect = [];
  const lines = draft.lines.map((line) => {
    if (!line.perPerson || line.quantity !== heads) return line;
    suspect.push(line.label);
    return { ...line, confidence: "placeholder" };
  });

  if (suspect.length === 0) return draft;

  return {
    ...draft,
    lines,
    assumptions: [
      `CHECK THE QUANTITIES: ${suspect.length} per-person line(s) have a quantity of ${heads}, the same as the traveller count — ${suspect.join("; ")}. If that was meant to be "one each", set the quantity to 1, because per-person lines are already multiplied by ${heads}. Left as-is, these lines are charged ${heads} times over.`,
      ...(draft.assumptions ?? []),
    ].slice(0, 10),
  };
}

/**
 * Compare the draft against what we actually publish, and say so.
 *
 * The prompt already tells the model the anchor and instructs it to price
 * consistently. It does not reliably comply: asked for a 5-day Dubai trip with
 * "Dubai, City & Desert — from ₹52,500 per person" in context, it produced
 * ₹95,150 per person — **1.8× our own published price** — and stated no reason
 * in assumptions.
 *
 * More prompting is the wrong fix, because the model is not doing the
 * arithmetic: it never totals its own lines per head and compares. The system
 * has both numbers, so the system checks.
 *
 * Flags, never reprices. The draft can legitimately exceed the from-price —
 * a from-price is the cheapest batch, and a premium hotel or peak dates really
 * do cost more. What is not acceptable is the salesperson not being told.
 */
function flagAnchorDrift(draft, context, groupSize) {
  const anchor = Math.min(
    ...[...context.trips, ...context.destinations]
      .map((item) => Number(item.fromPerPerson) || 0)
      .filter((n) => n > 0),
    Infinity
  );
  if (!Number.isFinite(anchor)) return draft;

  const heads = Math.max(1, Number(groupSize) || 1);
  const subtotal = draft.lines.reduce((sum, line) => {
    const multiplier = line.perPerson ? line.quantity * heads : line.quantity;
    return sum + (Number(line.unitPrice) || 0) * multiplier;
  }, 0);
  const perPerson = Math.round(subtotal / heads);

  // 40% is the band where a premium hotel or peak dates stop explaining it.
  if (perPerson <= anchor * 1.4) return draft;

  const over = Math.round(((perPerson - anchor) / anchor) * 100);
  return {
    ...draft,
    assumptions: [
      `CHECK THE PRICE: this draft works out at ₹${perPerson.toLocaleString(
        "en-IN"
      )} per person, ${over}% above the ₹${anchor.toLocaleString(
        "en-IN"
      )} we publish for a comparable trip. Justify it to the customer or bring it down — they may well have seen our website price already.`,
      ...(draft.assumptions ?? []),
    ].slice(0, 10),
  };
}

export async function draftQuotation({ lead, itinerary, instruction }) {
  const provider = getProvider();
  if (!provider) throw new PlannerUnavailableError();

  const plan = itinerary ?? lead.itinerary;

  // The grounding step. Everything this function is worth comes from here.
  const context = await buildPricingContext({
    destination: lead.destination ?? plan?.destination,
    month: lead.dates,
  });

  const prompt = [
    describeLead(lead, plan),
    "",
    renderPricingContext(context),
    instruction?.trim() ? `\n## The salesperson adds\n${instruction.trim()}` : "",
    "\nDraft the quotation.",
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await provider.generateJson({
    system: SYSTEM,
    prompt,
    schema: QuoteDraftSchema,
    // Raised from 8000: the draft now carries a day-by-day as well as the
    // pricing, and a 10-day trip truncated mid-JSON at the old ceiling.
    maxOutputTokens: 16000,
  });

  let parsed;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = QuoteDraftSchema.safeParse(JSON.parse(cleaned));
  } catch {
    return { error: "The draft came back unreadable. Try again, or build it by hand." };
  }

  if (!parsed.success) {
    console.error("[quote-ai] draft failed validation", parsed.error.issues[0]);
    return { error: "The draft did not match the expected shape. Try again, or build it by hand." };
  }

  // Both guards divide a line total by the head count to decide whether the
  // model double-counted a per-person price, so the count has to be the one
  // the price was actually built from. `groupSize` is whatever the website
  // form collected and may be stale or absent the moment a salesperson
  // confirms the party on the phone. Infants are excluded deliberately: they
  // occupy no seat and are rarely a priced head, so counting them would make
  // a correct per-person line look like a double-count.
  const heads = seatedTravellers(lead) || lead.groupSize;

  const checked = flagAnchorDrift(
    flagDoubleCountedLines(parsed.data, heads),
    context,
    heads
  );

  // `createQuotation` stores `draft.itinerary ?? lead.itinerary`, and the
  // templates render `quotation.itinerary.days`. So the generated days are
  // shaped into that envelope here rather than anywhere downstream — and an
  // itinerary the lead ALREADY has (from the public AI planner) wins, because
  // it is the plan the customer has actually seen.
  const draft = {
    ...checked,
    itinerary:
      plan ??
      (checked.days?.length
        ? {
            title: checked.title,
            destination: lead.destination ?? null,
            durationDays: checked.durationDays,
            days: checked.days,
          }
        : null),
  };

  return {
    draft,
    // Surfaced so the builder can say "priced against 3 comparable trips" —
    // or warn that it had nothing to anchor to, which is exactly when a
    // salesperson should check every figure.
    grounding: {
      anchored: context.hasAnchor,
      comparedWith: [
        ...context.trips.map((t) => t.title),
        ...context.destinations.map((d) => d.title),
      ],
      season: context.season,
    },
  };
}
