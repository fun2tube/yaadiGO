import "server-only";

import { z } from "zod";
import { createRecord, getRecord, listRecords, removeRecord, updateRecord } from "@/lib/cms/records";

/**
 * Hotels and their rate cards (docs/design/ai-cofounder.md, phase 1c).
 *
 * A rate is a price per room per night for one room type and meal plan over
 * a date range. Two rates for the same room and plan may not overlap: a night
 * with two prices would make every quotation depend on which row was read
 * first. Postgres enforces sell >= cost; this file enforces the overlap.
 *
 * Money is in rupees here, as everywhere above the repository.
 */

export const HOTELS = "hotels";
export const HOTEL_RATES = "hotelRates";

export const HOTEL_CATEGORIES = ["hotel", "resort", "homestay", "houseboat", "camp", "villa", "guesthouse"];
export const MEAL_PLANS = [
  { value: "EP", label: "Room only (EP)" },
  { value: "CP", label: "Breakfast (CP)" },
  { value: "MAP", label: "Breakfast + dinner (MAP)" },
  { value: "AP", label: "All meals (AP)" },
];
const MEAL_PLAN_VALUES = MEAL_PLANS.map((m) => m.value);

const text = (max) =>
  z
    .string()
    .max(max)
    .transform((v) => v.trim() || null)
    .nullable()
    .optional();

export const HotelSchema = z.object({
  name: z.string().trim().min(2, "Give the hotel a name.").max(160),
  destination: z.string().trim().min(2, "Which destination is it in?").max(80),
  city: text(80),
  category: z.enum(HOTEL_CATEGORIES).default("hotel"),
  stars: z.number().int().min(1).max(5).nullable().optional(),
  address: text(300),
  contactPerson: text(120),
  phone: text(40),
  email: text(160),
  website: text(300),
  notes: text(4000),
  imageId: text(200),
  active: z.boolean().default(true),
});

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date.");
const RUPEES = z.number().int("Whole rupees only.").min(0).max(10_000_000);

export const RateSchema = z
  .object({
    roomType: z.string().trim().min(1, "Which room type?").max(80),
    mealPlan: z.enum(MEAL_PLAN_VALUES),
    season: text(60),
    validFrom: DATE,
    validTo: DATE,
    cost: RUPEES,
    sell: RUPEES,
    extraBedCost: RUPEES.nullable().optional(),
    extraBedSell: RUPEES.nullable().optional(),
    notes: text(500),
  })
  .refine((r) => r.validTo >= r.validFrom, { message: "The rate ends before it starts.", path: ["validTo"] })
  .refine((r) => r.sell >= r.cost, { message: "The selling price is below what the room costs us.", path: ["sell"] })
  .refine((r) => r.extraBedSell == null || r.extraBedCost == null || r.extraBedSell >= r.extraBedCost, {
    message: "The extra-bed price is below its cost.",
    path: ["extraBedSell"],
  });

function firstIssue(error) {
  const issue = error.issues[0];
  return issue?.message ?? "That didn't look right.";
}

const sameName = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
const placeOf = (h) => String(h.city || h.destination || "").trim().toLowerCase();

export async function listHotels({ search = "", destination = null, includeInactive = false } = {}) {
  const [hotels, rates] = await Promise.all([listRecords(HOTELS), listRecords(HOTEL_RATES)]);
  const today = new Date().toISOString().slice(0, 10);
  const query = search.trim().toLowerCase();
  return hotels
    .filter((h) => includeInactive || h.active !== false)
    .filter((h) => !destination || sameName(h.destination, destination))
    .filter((h) => !query || [h.name, h.destination, h.city].some((v) => String(v ?? "").toLowerCase().includes(query)))
    .map((h) => {
      const own = rates.filter((r) => r.hotelId === h.id);
      const current = own.filter((r) => r.validTo >= today);
      return {
        ...h,
        rateCount: own.length,
        currentRates: current.length,
        // The cheapest room on sale today or later, for the list.
        fromSell: current.length ? Math.min(...current.map((r) => r.sell)) : null,
        ratesEndOn: current.length ? current.map((r) => r.validTo).sort().at(-1) : null,
      };
    })
    .sort((a, b) => a.destination.localeCompare(b.destination) || a.name.localeCompare(b.name));
}

export async function getHotel(id) {
  const hotel = await getRecord(HOTELS, id);
  if (!hotel) return null;
  const rates = (await listRecords(HOTEL_RATES))
    .filter((r) => r.hotelId === id)
    .sort((a, b) => a.roomType.localeCompare(b.roomType) || a.mealPlan.localeCompare(b.mealPlan) || a.validFrom.localeCompare(b.validFrom));
  return { hotel, rates };
}

/** Create (no id) or update a hotel. */
export async function saveHotel(input, id = null) {
  const parsed = HotelSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const data = parsed.data;

  const clash = (await listRecords(HOTELS)).find(
    (h) => h.id !== id && sameName(h.name, data.name) && placeOf(h) === placeOf(data)
  );
  if (clash) return { error: `${clash.name} in ${clash.city || clash.destination} is already in the directory.`, clashId: clash.id };

  if (id) {
    const existing = await getRecord(HOTELS, id);
    if (!existing) return { error: "That hotel no longer exists." };
    return { hotel: await updateRecord(HOTELS, id, data) };
  }
  return { hotel: await createRecord(HOTELS, data) };
}

const overlaps = (a, b) => a.validFrom <= b.validTo && b.validFrom <= a.validTo;

/** Add (no rateId) or change a rate, refusing a second price for any night. */
export async function saveRate(hotelId, input, rateId = null) {
  const hotel = await getRecord(HOTELS, hotelId);
  if (!hotel) return { error: "That hotel no longer exists." };
  const parsed = RateSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const rate = parsed.data;

  const clash = (await listRecords(HOTEL_RATES)).find(
    (r) =>
      r.hotelId === hotelId &&
      r.id !== rateId &&
      sameName(r.roomType, rate.roomType) &&
      r.mealPlan === rate.mealPlan &&
      overlaps(r, rate)
  );
  if (clash) {
    return {
      error: `${rate.roomType} ${rate.mealPlan} already has a price from ${clash.validFrom} to ${clash.validTo}. Shorten one so each night has one price.`,
    };
  }

  const row = {
    ...rate,
    extraBedCost: rate.extraBedCost ?? null,
    extraBedSell: rate.extraBedSell ?? null,
    hotelId,
  };
  if (rateId) {
    const existing = await getRecord(HOTEL_RATES, rateId);
    if (!existing || existing.hotelId !== hotelId) return { error: "That rate no longer exists." };
    return { rate: await updateRecord(HOTEL_RATES, rateId, row) };
  }
  return { rate: await createRecord(HOTEL_RATES, row) };
}

export async function removeRate(hotelId, rateId) {
  const existing = await getRecord(HOTEL_RATES, rateId);
  if (!existing || existing.hotelId !== hotelId) return { error: "That rate no longer exists." };
  await removeRecord(HOTEL_RATES, rateId);
  return { ok: true };
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * What a stay costs, night by night, for every room type and meal plan the
 * hotel prices. A stay can cross from one season into the next, so each
 * night is priced on its own rate. A night with no rate makes that option
 * incomplete: reported, never guessed.
 *
 * Totals are per room for the whole stay; the quotation multiplies by rooms.
 */
export async function priceStay(hotelId, { checkIn, nights }) {
  const found = await getHotel(hotelId);
  if (!found) return null;
  const count = Math.max(1, Math.min(60, Number(nights) || 1));
  const dates = Array.from({ length: count }, (_, i) => addDays(checkIn, i));

  const options = new Map();
  for (const r of found.rates) {
    const key = `${r.roomType.toLowerCase()}|${r.mealPlan}`;
    if (!options.has(key)) options.set(key, { roomType: r.roomType, mealPlan: r.mealPlan, rates: [] });
    options.get(key).rates.push(r);
  }

  return {
    hotel: found.hotel,
    checkIn,
    nights: count,
    options: [...options.values()]
      .map((option) => {
        let cost = 0;
        let sell = 0;
        const missing = [];
        const seasons = new Set();
        for (const night of dates) {
          const rate = option.rates.find((r) => r.validFrom <= night && night <= r.validTo);
          if (!rate) {
            missing.push(night);
            continue;
          }
          cost += rate.cost;
          sell += rate.sell;
          if (rate.season) seasons.add(rate.season);
        }
        return {
          roomType: option.roomType,
          mealPlan: option.mealPlan,
          complete: missing.length === 0,
          missingNights: missing,
          seasons: [...seasons],
          cost,
          sell,
        };
      })
      .sort((a, b) => Number(b.complete) - Number(a.complete) || a.sell - b.sell),
  };
}
