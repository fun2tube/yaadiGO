import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { updateBrief } from "@/lib/crm/leads";
import {
  HOTEL_CATEGORY_VALUES,
  MEAL_PLAN_VALUES,
  ROOM_CLASS_VALUES,
  OCCUPANCY_VALUES,
  TRANSPORT_MODE_VALUES,
} from "@/lib/crm/brief";

export const dynamic = "force-dynamic";

/**
 * Saving the trip brief.
 *
 * Its own route rather than another branch inside the leads PATCH: that
 * handler already juggles call outcomes, stage changes, follow-up dates and
 * notes, with ordering rules between them. The brief shares none of that and
 * folding it in would mean a fifth interaction to reason about.
 *
 * Every field is optional. A brief is filled in while the phone is ringing,
 * saved in pieces, and a schema that demands the whole thing at once loses the
 * half the salesperson had already got.
 */

// A plain date, not a datetime. A departure is a calendar day, and the moment
// a timezone is involved a 1 June trip starts showing as 31 May to somebody.
const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-06-15.")
  .nullable()
  .optional();

const RoomSchema = z.object({
  roomClass: z.enum(ROOM_CLASS_VALUES),
  occupancy: z.enum(OCCUPANCY_VALUES),
  extraMattress: z.number().int().min(0).max(4).default(0),
  count: z.number().int().min(1).max(50).default(1),
});

const StaySchema = z.object({
  city: z.string().max(120).default(""),
  nights: z.number().int().min(0).max(60).default(0),
  hotelCategory: z.enum(HOTEL_CATEGORY_VALUES).nullable().optional(),
  mealPlan: z.enum(MEAL_PLAN_VALUES).nullable().optional(),
  note: z.string().max(500).default(""),
});

const LegSchema = z.object({
  mode: z.enum(TRANSPORT_MODE_VALUES),
  from: z.string().max(120).default(""),
  to: z.string().max(120).default(""),
  note: z.string().max(500).default(""),
});

const BriefSchema = z.object({
  hotelCategory: z.enum(HOTEL_CATEGORY_VALUES).nullable().optional(),
  mealPlan: z.enum(MEAL_PLAN_VALUES).nullable().optional(),
  transportModes: z.array(z.enum(TRANSPORT_MODE_VALUES)).max(6).default([]),
  rooms: z.array(RoomSchema).max(30).default([]),
  stays: z.array(StaySchema).max(30).default([]),
  legs: z.array(LegSchema).max(40).default([]),
  specialRequests: z.string().max(2000).default(""),
});

const PayloadSchema = z.object({
  id: z.string().min(1),
  departureDate: DateOnly,
  returnDate: DateOnly,
  departureFlexible: z.boolean().optional(),
  adults: z.number().int().min(0).max(200).nullable().optional(),
  // 17 is the ceiling because 18+ is an adult; the band logic in brief.js
  // treats 12+ as adult-rate but the age is still worth recording.
  children: z.array(z.object({ age: z.number().int().min(0).max(17) })).max(12).optional(),
  infants: z.number().int().min(0).max(20).optional(),
  budgetAmount: z.number().min(0).max(100000000).nullable().optional(),
  budgetPerPerson: z.boolean().optional(),
  brief: BriefSchema.optional(),
});

export async function POST(request) {
  const { user, denied } = await authorise("leads.write");
  if (denied) return denied;

  const parsed = PayloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "That didn't look right." },
      { status: 400 }
    );
  }

  const { id, ...patch } = parsed.data;
  const result = await updateBrief(id, patch, { actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  // `gaps` is what the builder shows as "still missing" — returned on every
  // save so the salesperson watches the list shrink as they fill it in.
  return Response.json({ lead: result.lead, gaps: result.gaps });
}
