import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import { BOOKINGS, createBookingRequest } from "@/lib/cms/bookings";
import { updateRecord } from "@/lib/cms/records";
import {
  WAITLIST_STATUSES,
  cancelDeparture,
  convertHold,
  createHold,
  releaseHold,
  setDepartureClosed,
  setWaitlistStatus,
} from "@/lib/cms/seats";

export const dynamic = "force-dynamic";

/**
 * The departures desk (docs/design/trip-management.md §4.2, phase 2).
 *
 * Holds and the waitlist are sales work (bookings.write). Closing or
 * cancelling a batch changes what the business sells, so it needs
 * catalogue.write. Every seat-affecting action runs under the trip's lock in
 * lib/cms/seats.js.
 */

const Slug = z.string().min(1).max(120);
const Id = z.string().min(1).max(80);

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("hold"),
    tripSlug: Slug,
    departureId: Id,
    seats: z.number().int().min(1).max(20),
    name: z.string().min(1).max(120),
    phone: z.string().max(30).optional(),
    leadId: z.string().max(80).nullable().optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({ action: z.literal("release"), holdId: Id }),
  z.object({ action: z.literal("convert"), holdId: Id }),
  z.object({ action: z.literal("waitlist"), id: Id, status: z.enum(WAITLIST_STATUSES) }),
  z.object({ action: z.literal("close"), tripSlug: Slug, departureId: Id }),
  z.object({ action: z.literal("reopen"), tripSlug: Slug, departureId: Id }),
  z.object({ action: z.literal("cancel"), tripSlug: Slug, departureId: Id }),
]);

const NEEDS = {
  hold: "bookings.write",
  release: "bookings.write",
  convert: "bookings.write",
  waitlist: "bookings.write",
  close: "catalogue.write",
  reopen: "catalogue.write",
  cancel: "catalogue.write",
};

export async function POST(request) {
  const raw = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json({ message: issue?.message ?? "That request is not one this screen sends." }, { status: 400 });
  }
  const body = parsed.data;

  const { user, denied } = await authorise(NEEDS[body.action]);
  if (denied) return denied;
  const actor = { id: user.id, name: user.name };

  let result;
  switch (body.action) {
    case "hold":
      result = await createHold({ ...body, actor });
      break;
    case "release":
      result = await releaseHold(body.holdId, { actor });
      break;
    case "convert":
      result = await convertHold(body.holdId, {
        makeBooking: async (hold) => {
          const booking = await createBookingRequest({
            tripSlug: hold.tripSlug,
            departureId: hold.departureId,
            travellers: hold.seats,
            leadId: hold.leadId,
            contact: { name: hold.name, phone: hold.phone },
            fromHold: true,
          });
          if (!booking) return null;
          // Straight to confirmed: the seats were already this customer's.
          return updateRecord(BOOKINGS, booking.id, {
            status: "confirmed",
            seatsHeld: hold.seats,
            notes: [{ body: `Confirmed from a hold by ${actor.name}.`, at: new Date().toISOString() }],
          });
        },
      });
      break;
    case "waitlist":
      result = await setWaitlistStatus(body.id, body.status, { actor });
      break;
    case "close":
    case "reopen":
      result = await setDepartureClosed(body.tripSlug, body.departureId, body.action === "close");
      break;
    case "cancel":
      result = await cancelDeparture(body.tripSlug, body.departureId);
      break;
  }

  if (result?.error) return Response.json({ message: result.error }, { status: 409 });

  // Seats or availability changed, so every page that shows them is stale.
  if (body.action !== "waitlist") {
    revalidatePath("/", "layout");
    revalidatePath("/sitemap.xml");
  }
  return Response.json({ ok: true, ...result });
}
