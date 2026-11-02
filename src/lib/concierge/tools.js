import { z } from "zod";
import { groupTours, formatDepartureRange } from "@/lib/tours";
import { packages } from "@/lib/packages";
import { encodeTrip } from "@/lib/trip-link";

/**
 * The concierge's hands.
 *
 * Everything the concierge says about inventory comes through these tools, not
 * from the model's memory. That is the whole point: an assistant that invents a
 * departure date or a price is worse than no assistant at all for a travel
 * company that has to honour what the page said.
 *
 * THIS FILE IS THE DATA SEAM. Today the tools read the static content modules
 * in src/lib/. When the admin panel and database land, only the bodies below
 * change — the tool schemas, the prompt and the whole UI stay as they are.
 */

const THEMES = Array.from(new Set(groupTours.map((t) => t.theme)));

/**
 * The live catalogue, when the caller has it.
 *
 * The concierge route loads the merged catalogue (admin-created trips,
 * edits, unpublished ones removed) and passes it as `ctx`. Without it — in a
 * test, or anywhere the database is not reachable — the tools fall back to
 * the catalogue in code, so they always answer from SOMETHING real.
 */
const toursOf = (ctx) => ctx?.trips ?? groupTours;
const packagesOf = (ctx) => ctx?.destinations ?? packages;
const tourIn = (ctx, slug) => toursOf(ctx).find((t) => t.slug === slug) ?? null;

/** Trimmed shape sent to the model — full itineraries would flood the context. */
function summarise(tour) {
  return {
    slug: tour.slug,
    title: tour.title,
    destination: tour.destination,
    theme: tour.theme,
    duration: tour.duration,
    pricePerPerson: tour.price,
    nextDeparture: tour.nextDeparture,
    seatsLeft: tour.seatsLeft,
    departuresAvailable: tour.departureCount,
    summary: tour.heroNote,
  };
}

/** The card payload the browser renders inline in the conversation. */
function toCard(tour) {
  return { type: "trip", ...summarise(tour) };
}

function nights(tour) {
  const match = /(\d+)\s*N/i.exec(tour.duration);
  return match ? Number(match[1]) : null;
}

export const conciergeTools = [
  {
    name: "search_trips",
    description:
      "Search YaadiGo's real fixed-departure group tours. Use this whenever the traveller asks what trips exist, mentions a destination or a theme, or asks what fits a budget or a number of days. Never describe a trip that this tool has not returned.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Free text to match against destination and title, e.g. 'kashmir' or 'beach'")
        .optional(),
      theme: z.enum(THEMES).describe("Restrict to one theme").optional(),
      maxPricePerPerson: z.number().int().describe("Maximum per-person price in INR").optional(),
      maxNights: z.number().int().describe("Longest acceptable trip in nights").optional(),
    }),
    run: ({ query, theme, maxPricePerPerson, maxNights }, ctx) => {
      const needle = query?.trim().toLowerCase();

      const matches = toursOf(ctx).filter((tour) => {
        if (theme && tour.theme !== theme) return false;
        if (maxPricePerPerson && tour.price > maxPricePerPerson) return false;
        if (maxNights) {
          const n = nights(tour);
          if (n !== null && n > maxNights) return false;
        }
        if (needle) {
          const haystack =
            `${tour.title} ${tour.destination} ${tour.theme} ${tour.heroNote}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      });

      return {
        // The model reads this...
        found: matches.length,
        trips: matches.map(summarise),
        // ...and the browser renders these as real cards.
        _cards: matches.map(toCard),
        note:
          matches.length === 0
            ? "No fixed departure matches. Suggest a customized trip and offer the AI planner."
            : undefined,
      };
    },
  },

  {
    name: "get_trip",
    description:
      "Get the full day-by-day itinerary, inclusions, exclusions and FAQs for one group tour. Use this before answering any detailed question about a specific trip — what is included, what a day looks like, whether something is covered.",
    inputSchema: z.object({
      slug: z.string().describe("The trip's slug, from search_trips"),
    }),
    run: ({ slug }, ctx) => {
      const tour = tourIn(ctx, slug);
      if (!tour) {
        return { error: "No trip with that slug. Call search_trips first." };
      }
      return {
        ...summarise(tour),
        itinerary: tour.itinerary,
        inclusions: tour.inclusions,
        exclusions: tour.exclusions,
        faq: tour.faq,
        _cards: [toCard(tour)],
      };
    },
  },


  {
    name: "check_departures",
    description:
      "List every fixed departure batch for one trip, with its date range, price and seats left. Use this whenever dates, months, availability or 'is it full' come up — it is what moves a browser towards a decision, so reach for it early rather than late.",
    inputSchema: z.object({
      slug: z.string().describe("The trip's slug, from search_trips"),
      month: z
        .string()
        .describe("Optional month filter, e.g. 'December' or '2026-12'")
        .optional(),
    }),
    run: ({ slug, month }, ctx) => {
      const tour = tourIn(ctx, slug);
      if (!tour) return { error: "No trip with that slug. Call search_trips first." };

      let departures = tour.departures;
      if (month) {
        const needle = month.trim().toLowerCase();
        departures = departures.filter((d) => {
          const label = formatDepartureRange(d).toLowerCase();
          return label.includes(needle) || d.start.startsWith(needle);
        });
      }

      const rows = departures.map((d) => ({
        id: d.id,
        dates: formatDepartureRange(d),
        pricePerPerson: d.price,
        seatsLeft: d.seatsLeft,
        status: d.status,
      }));

      return {
        trip: tour.title,
        advanceToHoldASeat: tour.advanceAmount,
        sharingOptions: tour.sharing.map((o) => ({ label: o.label, extraPerPerson: o.delta })),
        joiningFrom: tour.pickups.map((p) => ({ city: p.city, extraPerPerson: p.delta })),
        departures: rows,
        note: rows.length === 0 ? "No batches match that month. Offer the ones that exist." : undefined,
        _cards: [
          {
            type: "departures",
            slug: tour.slug,
            title: tour.title,
            advance: tour.advanceAmount,
            departures: rows,
          },
        ],
      };
    },
  },

  {
    name: "start_booking",
    description:
      "Put a one-tap booking button in the chat for a specific trip and departure batch, pre-selected. Use it once the traveller has settled on both. Do not use it to guess for them — call check_departures first and let them pick.",
    inputSchema: z.object({
      slug: z.string().describe("The trip's slug"),
      departureId: z.string().describe("The departure id, from check_departures"),
      travellers: z.number().int().min(1).max(10).default(2),
    }),
    run: ({ slug, departureId, travellers }, ctx) => {
      const tour = tourIn(ctx, slug);
      if (!tour) return { error: "No trip with that slug." };

      const departure = tour.departures.find((d) => d.id === departureId);
      if (!departure) return { error: "No such departure. Call check_departures first." };
      if (departure.status === "soldout") {
        return { error: "That batch is sold out — offer the traveller another date." };
      }

      return {
        ok: true,
        trip: tour.title,
        dates: formatDepartureRange(departure),
        advance: tour.advanceAmount * travellers,
        _cards: [
          {
            type: "booking",
            slug: tour.slug,
            title: tour.title,
            dates: formatDepartureRange(departure),
            pricePerPerson: departure.price,
            seatsLeft: departure.seatsLeft,
            travellers,
            advance: tour.advanceAmount * travellers,
            href: `/group-tours/${tour.slug}#book`,
          },
        ],
      };
    },
  },

  {
    name: "compare_trips",
    description:
      "Put two or more group tours side by side. Use when the traveller is choosing between options, or asks 'which is better'.",
    inputSchema: z.object({
      slugs: z.array(z.string()).min(2).max(4).describe("Slugs to compare, from search_trips"),
    }),
    run: ({ slugs }, ctx) => {
      const found = slugs.map((s) => tourIn(ctx, s)).filter(Boolean);
      if (found.length < 2) {
        return { error: "Need at least two valid slugs. Call search_trips first." };
      }
      return {
        trips: found.map(summarise),
        _cards: [{ type: "comparison", trips: found.map(summarise) }],
      };
    },
  },


  {
    name: "search_destinations",
    description:
      "Search YaadiGo's CUSTOMISED trip destinations — trips planned around the traveller's own dates, with no fixed batches. Use this when they want somewhere we don't run a group departure to, want their own dates, are travelling as a honeymoon/family/pilgrimage, or when search_trips comes back empty. These are enquiry-led: there is nothing to book, only a free itinerary to request.",
    inputSchema: z.object({
      query: z.string().describe("Free text: a destination or region, e.g. 'maldives' or 'kerala'").optional(),
      region: z.enum(["India", "International"]).optional(),
      goodFor: z
        .string()
        .describe("Who it suits, e.g. 'Honeymoon', 'Family', 'Wildlife', 'Pilgrimage'")
        .optional(),
      maxFromPrice: z.number().int().describe("Maximum indicative per-person price in INR").optional(),
    }),
    run: ({ query, region, goodFor, maxFromPrice }, ctx) => {
      const needle = query?.trim().toLowerCase();
      const tag = goodFor?.trim().toLowerCase();

      const matches = packagesOf(ctx).filter((pkg) => {
        if (region && pkg.region !== region) return false;
        if (maxFromPrice && pkg.fromPrice > maxFromPrice) return false;
        if (tag && !pkg.idealFor.some((t) => t.toLowerCase().includes(tag))) return false;
        if (needle) {
          const hay = `${pkg.title} ${pkg.destination} ${pkg.theme} ${pkg.heroNote} ${pkg.places.join(" ")}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });

      return {
        found: matches.length,
        note: "These are customised trips — no fixed dates or seats. The traveller requests a free itinerary rather than booking.",
        destinations: matches.map((pkg) => ({
          slug: pkg.slug,
          title: pkg.title,
          destination: pkg.destination,
          region: pkg.region,
          duration: pkg.duration,
          fromPricePerPerson: pkg.fromPrice,
          bestTime: pkg.bestTime,
          goodFor: pkg.idealFor,
          covers: pkg.places.slice(0, 8),
        })),
        _cards: matches.slice(0, 4).map((pkg) => ({
          type: "destination",
          slug: pkg.slug,
          title: pkg.title,
          destination: pkg.destination,
          duration: pkg.duration,
          fromPrice: pkg.fromPrice,
          bestTime: pkg.bestTime,
          goodFor: pkg.idealFor.slice(0, 2),
        })),
      };
    },
  },

  {
    name: "open_planner",
    description:
      "Offer the AI trip planner, pre-filled, when the traveller wants something no fixed departure covers — their own dates, a different length, a destination we don't run a group tour to. Produces a button that opens the planner with their brief already entered.",
    inputSchema: z.object({
      destination: z.string().describe("Where they want to go"),
      durationDays: z.number().int().min(1).max(21),
      travellers: z.number().int().min(1).max(40).default(2),
      month: z.string().describe("Roughly when, e.g. 'early December'").optional(),
      pace: z.enum(["relaxed", "balanced", "packed"]).default("balanced"),
      budget: z
        .enum(["shoestring", "comfortable", "premium", "luxury"])
        .default("comfortable"),
      interests: z.array(z.string()).default([]),
    }),
    run: (input) => {
      const trip = {
        destination: input.destination,
        durationDays: input.durationDays,
        month: input.month ?? "",
        travellers: input.travellers,
        travelWith: input.travellers === 1 ? "solo" : "couple",
        budget: input.budget,
        pace: input.pace,
        interests: [],
        notes: "",
      };
      const encoded = encodeTrip(trip);
      return {
        ok: true,
        _cards: [
          {
            type: "planner",
            destination: input.destination,
            durationDays: input.durationDays,
            href: encoded ? `/plan?trip=${encoded}` : "/plan",
          },
        ],
      };
    },
  },

  {
    name: "hand_to_human",
    description:
      "Show the traveller a short form that puts them in touch with a real travel expert. Use when they ask to speak to someone, want firm pricing or availability, are ready to book, or ask something you genuinely cannot answer. Never invent availability or a firm quote — hand over instead.",
    inputSchema: z.object({
      reason: z
        .string()
        .describe("One line for the desk on what they want, e.g. 'Wants Kashmir in Oct for 4'"),
    }),
    run: ({ reason }) => ({
      ok: true,
      _cards: [{ type: "handoff", reason }],
    }),
  },

  {
    name: "capture_interest",
    description:
      "Quietly record what this traveller is looking for, so the travel desk knows what people are asking about. Call this as soon as you know a DESTINATION plus any one of: month or dates, number of travellers, or budget. Call it again whenever you learn more — it updates the same record rather than creating a second one. It shows the traveller nothing and interrupts nothing, so there is no reason to hold off. This is not a handover: use hand_to_human when they actually want to speak to someone.",
    inputSchema: z.object({
      destination: z.string().max(120).describe("Where they want to go"),
      month: z
        .string()
        .max(60)
        .optional()
        .describe("Month or dates, in their own words — 'October', 'end of Nov'"),
      travellers: z.number().int().min(1).max(60).optional().describe("How many people"),
      budget: z.string().max(80).optional().describe("Budget, in their own words"),
      note: z
        .string()
        .max(300)
        .optional()
        .describe("Anything else the desk should know — 'honeymoon', 'parents, no trekking'"),
    }),
    // The run body is supplied by the route, which has the conversation id and
    // the server-only record store. Tools in this file stay data-shaped so the
    // module can be imported anywhere; the side effect lives at the seam.
    run: (input) => ({ ok: true, _interest: input }),
  },
];

/** Names only — used by the UI to show what the concierge is doing. */
export const TOOL_LABELS = {
  search_trips: "Checking live departures",
  search_destinations: "Looking through destinations",
  check_departures: "Looking up dates and seats",
  start_booking: "Setting up your booking",
  get_trip: "Reading the itinerary",
  compare_trips: "Comparing trips",
  open_planner: "Preparing the planner",
  hand_to_human: "Bringing in a human",
  // Deliberately quiet — it records demand, it does not do anything the
  // traveller asked for, so announcing it would read as surveillance.
  capture_interest: "",
};
