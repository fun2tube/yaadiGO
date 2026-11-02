/**
 * The trip brief — what the customer wants, as structured data.
 *
 * Distinct from the QUOTATION, which is what it costs. The brief is the input;
 * the priced lines are the output. Keeping them apart is what lets the AI
 * builder read one and write the other instead of inventing both.
 *
 * Why this exists at all: a salesperson used to receive `dates: "mid-June,
 * flexible"`, `budget: "around 40-50k"` and a group size, and had to telephone
 * the customer to learn the four things that actually drive the price — hotel
 * standard, meal plan, how they move between cities, and who is travelling.
 * That call is the difference between a two-minute quotation and a two-day one.
 *
 * Safe to import from the browser: no server-only dependencies.
 */

/**
 * Where they stay.
 *
 * NOT a quality ladder. A Spiti campsite and a Goa villa are not "below
 * 3-star" — they are a different kind of stay, chosen on purpose. So this
 * drives the brief and the filter, never a sort.
 */
export const HOTEL_CATEGORIES = [
  { value: "budget", label: "Budget hotel" },
  { value: "3-star", label: "3 star" },
  { value: "4-star", label: "4 star" },
  { value: "5-star", label: "5 star" },
  { value: "resort", label: "Resort" },
  { value: "villa", label: "Villa" },
  { value: "homestay", label: "Homestay" },
  { value: "campsite", label: "Campsite" },
];

/**
 * Meal plans, in the hotel industry's own codes.
 *
 * Shown to staff as the code, to customers as the plain English — staff know
 * "MAP", customers do not, and the quotation is a customer document.
 *
 * EP is included although it was not asked for: room-only is common on
 * customised trips where guests want to eat out, and without it a salesperson
 * has to misuse CP and the quotation then promises a breakfast nobody booked.
 *
 * Which meal MAP covers varies by property, so it is recorded per stay rather
 * than assumed here.
 */
export const MEAL_PLANS = [
  { value: "EP", label: "Room only", code: "EP" },
  { value: "CP", label: "Breakfast", code: "CP" },
  { value: "MAP", label: "Breakfast + one meal", code: "MAP" },
  { value: "AP", label: "All meals", code: "AP" },
];

/**
 * Room CLASS — what the room is.
 *
 * Deliberately separate from occupancy below. "Deluxe" says how big and how
 * well equipped; it says nothing about how many people sleep in it. A real
 * hotel line is both at once — a deluxe room at double occupancy with one
 * extra mattress — and a single flat list cannot express that.
 */
export const ROOM_CLASSES = [
  { value: "standard", label: "Standard" },
  { value: "deluxe", label: "Deluxe" },
  { value: "super-deluxe", label: "Super deluxe" },
  { value: "premium", label: "Premium" },
  { value: "business", label: "Business" },
  { value: "suite", label: "Suite" },
  { value: "cottage", label: "Cottage" },
  { value: "tent", label: "Tent" },
];

/** Room OCCUPANCY — how many people it sleeps. The other axis. */
export const OCCUPANCIES = [
  { value: "single", label: "Single", sleeps: 1 },
  { value: "double", label: "Double", sleeps: 2 },
  { value: "triple", label: "Triple", sleeps: 3 },
  { value: "quad", label: "Quad / family", sleeps: 4 },
];

/** How they move between places. `ferry` because Andaman and Alleppey need it. */
export const TRANSPORT_MODES = [
  { value: "car", label: "Car" },
  { value: "bus", label: "Bus / tempo traveller" },
  { value: "train", label: "Train" },
  { value: "flight", label: "Flight" },
  { value: "ferry", label: "Ferry" },
  { value: "self-drive", label: "Self drive" },
];

export const HOTEL_CATEGORY_VALUES = HOTEL_CATEGORIES.map((h) => h.value);
export const MEAL_PLAN_VALUES = MEAL_PLANS.map((m) => m.value);
export const ROOM_CLASS_VALUES = ROOM_CLASSES.map((r) => r.value);
export const OCCUPANCY_VALUES = OCCUPANCIES.map((o) => o.value);
export const TRANSPORT_MODE_VALUES = TRANSPORT_MODES.map((t) => t.value);

const labelOf = (list, value) => list.find((x) => x.value === value)?.label ?? null;

export const hotelCategoryLabel = (v) => labelOf(HOTEL_CATEGORIES, v);
export const roomClassLabel = (v) => labelOf(ROOM_CLASSES, v);
export const occupancyLabel = (v) => labelOf(OCCUPANCIES, v);
export const transportLabel = (v) => labelOf(TRANSPORT_MODES, v);

/** "Breakfast (CP)" — the customer-facing form, with the code for staff. */
export function mealPlanLabel(value) {
  const plan = MEAL_PLANS.find((m) => m.value === value);
  return plan ? `${plan.label} (${plan.code})` : null;
}

/**
 * Child age bands.
 *
 * Indian hotels almost always break at 5 and 12, and airlines use their own
 * bands entirely — which is exactly why the brief stores the AGE and derives
 * the band, instead of storing a band and losing the age. Two children aged 4
 * and 11 do not price the same, and a headcount cannot tell them apart.
 *
 * The band is advisory. The actual allowance is per property and stays a
 * decision the salesperson makes with the hotel, not one this file makes.
 */
export const CHILD_BANDS = [
  { value: "infant", label: "Under 2 — usually lap, no seat", max: 1 },
  { value: "free", label: "2 to 4 — usually free, no bed", max: 4 },
  { value: "no-bed", label: "5 to 11 — charged, often without a bed", max: 11 },
  { value: "adult-rate", label: "12 and over — usually adult rate", max: 200 },
];

export function childBand(age) {
  // `Number(null)` and `Number("")` are both 0, which is a finite number in
  // the infant band — so a child whose age was never entered would be banded
  // as an infant, the CHEAPEST band. Wrong in the expensive direction, and
  // silent. Missing has to be rejected before the numeric check, not by it.
  if (age === null || age === undefined || age === "") return null;
  const n = Number(age);
  if (!Number.isFinite(n) || n < 0) return null;
  return CHILD_BANDS.find((b) => n <= b.max) ?? CHILD_BANDS[CHILD_BANDS.length - 1];
}

/** Everyone who needs a seat in a vehicle — infants excluded, they travel on a lap. */
export function seatedTravellers(brief) {
  const b = brief ?? {};
  return (Number(b.adults) || 0) + (b.children?.length ?? 0);
}

/** Everyone, including infants. What the hotel and the itinerary count. */
export function totalTravellers(brief) {
  return seatedTravellers(brief) + (Number(brief?.infants) || 0);
}

/** How many beds the chosen rooms actually provide, for the mismatch warning. */
export function roomCapacity(rooms = []) {
  return rooms.reduce((sum, room) => {
    const sleeps = OCCUPANCIES.find((o) => o.value === room.occupancy)?.sleeps ?? 0;
    const count = Math.max(1, Number(room.count) || 1);
    return sum + (sleeps + (Number(room.extraMattress) || 0)) * count;
  }, 0);
}

export function emptyRoom() {
  return { roomClass: "standard", occupancy: "double", extraMattress: 0, count: 1 };
}

export function emptyBrief() {
  return {
    // Trip-level defaults. A stay may override either; most trips never need to.
    hotelCategory: null,
    mealPlan: null,
    transportModes: [],
    rooms: [emptyRoom()],
    // Multi-city trips define these; a single-destination enquiry leaves them
    // empty and inherits the trip-level values above.
    stays: [],
    legs: [],
    specialRequests: "",
  };
}

/**
 * Coerce whatever is in the database into a brief the UI can render.
 *
 * Every lead written before this field existed has `brief: null`, and every
 * one of them still has to open. Unknown enum values are dropped rather than
 * rendered, so a hand-edited row cannot put an unselectable option in a
 * dropdown.
 */
export function normaliseBrief(raw) {
  const base = emptyBrief();
  if (!raw || typeof raw !== "object") return base;

  const pick = (value, allowed) => (allowed.includes(value) ? value : null);

  return {
    hotelCategory: pick(raw.hotelCategory, HOTEL_CATEGORY_VALUES),
    mealPlan: pick(raw.mealPlan, MEAL_PLAN_VALUES),
    transportModes: Array.isArray(raw.transportModes)
      ? raw.transportModes.filter((m) => TRANSPORT_MODE_VALUES.includes(m))
      : [],
    rooms: Array.isArray(raw.rooms) && raw.rooms.length
      ? raw.rooms.map((room) => ({
          roomClass: pick(room?.roomClass, ROOM_CLASS_VALUES) ?? "standard",
          occupancy: pick(room?.occupancy, OCCUPANCY_VALUES) ?? "double",
          extraMattress: Math.max(0, Number(room?.extraMattress) || 0),
          count: Math.max(1, Number(room?.count) || 1),
        }))
      : [emptyRoom()],
    stays: Array.isArray(raw.stays)
      ? raw.stays.map((stay) => ({
          city: String(stay?.city ?? ""),
          nights: Math.max(0, Number(stay?.nights) || 0),
          hotelCategory: pick(stay?.hotelCategory, HOTEL_CATEGORY_VALUES),
          mealPlan: pick(stay?.mealPlan, MEAL_PLAN_VALUES),
          note: String(stay?.note ?? ""),
        }))
      : [],
    legs: Array.isArray(raw.legs)
      ? raw.legs.map((leg) => ({
          mode: pick(leg?.mode, TRANSPORT_MODE_VALUES) ?? "car",
          from: String(leg?.from ?? ""),
          to: String(leg?.to ?? ""),
          note: String(leg?.note ?? ""),
        }))
      : [],
    specialRequests: String(raw.specialRequests ?? ""),
  };
}

/**
 * Is there enough here to draft a quotation without ringing the customer?
 *
 * Used to show the salesperson what is still missing BEFORE they open the
 * builder — the two-minute target dies on a half-filled brief, and finding out
 * halfway through is worse than knowing up front.
 */
export function briefGaps({ brief, departureDate, adults }) {
  const b = normaliseBrief(brief);
  const gaps = [];
  if (!departureDate) gaps.push("departure date");
  if (!adults) gaps.push("number of adults");
  if (!b.hotelCategory && !b.stays.some((s) => s.hotelCategory)) gaps.push("hotel category");
  if (!b.mealPlan && !b.stays.some((s) => s.mealPlan)) gaps.push("meal plan");
  if (!b.transportModes.length && !b.legs.length) gaps.push("transport");
  return gaps;
}

/** One line for a list row: "4 star · Breakfast (CP) · 2 rooms · Car". */
export function briefSummary(brief) {
  const b = normaliseBrief(brief);

  // `normaliseBrief` always hands back one default room so the editor has a
  // row to draw. That default is not a FACT about the trip, and reporting
  // "1 room" against a lead whose brief was never opened would put a
  // confident-looking summary on a lead nobody has touched. Nothing stated
  // means nothing to say.
  const stated =
    b.hotelCategory || b.mealPlan || b.transportModes.length || b.stays.length || b.legs.length;
  if (!stated) return "";

  const parts = [];
  if (b.hotelCategory) parts.push(hotelCategoryLabel(b.hotelCategory));
  if (b.mealPlan) parts.push(mealPlanLabel(b.mealPlan));
  const rooms = b.rooms.reduce((n, r) => n + (Number(r.count) || 1), 0);
  if (rooms) parts.push(`${rooms} ${rooms === 1 ? "room" : "rooms"}`);
  if (b.transportModes.length) parts.push(b.transportModes.map(transportLabel).join(" + "));
  return parts.join(" · ");
}

/** "2 adults, 1 child (7), 1 infant" — for the quotation and the lead header. */
export function travellerSummary({ adults, children, infants }) {
  const parts = [];
  const a = Number(adults) || 0;
  if (a) parts.push(`${a} ${a === 1 ? "adult" : "adults"}`);
  const kids = Array.isArray(children) ? children : [];
  if (kids.length) {
    const ages = kids.map((c) => c?.age).filter((x) => x !== null && x !== undefined);
    parts.push(
      `${kids.length} ${kids.length === 1 ? "child" : "children"}${ages.length ? ` (${ages.join(", ")})` : ""}`
    );
  }
  const i = Number(infants) || 0;
  if (i) parts.push(`${i} ${i === 1 ? "infant" : "infants"}`);
  return parts.join(", ");
}
