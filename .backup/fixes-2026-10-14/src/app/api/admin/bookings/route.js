import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/cms/auth";
import { removeRecord } from "@/lib/cms/records";
import {
  BOOKINGS,
  BOOKING_STATUSES,
  addBookingNote,
  holdsSeats,
  listBookings,
  setBookingStatus,
} from "@/lib/cms/bookings";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  id: z.string().min(1).max(80),
  status: z.enum(BOOKING_STATUSES).optional(),
  note: z.string().max(2000).optional(),
});

export async function GET() {
  const denied = await requireAuth("bookings.read");
  if (denied) return denied;

  const bookings = await listBookings();
  const counts = BOOKING_STATUSES.reduce((acc, status) => {
    acc[status] = bookings.filter((b) => b.status === status).length;
    return acc;
  }, {});

  // Money the desk is still waiting on. Confirmed-but-unpaid is the number
  // that decides who gets phoned this afternoon.
  const awaitingPayment = bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + (b.advance ?? 0), 0);

  return Response.json({ bookings, counts, total: bookings.length, awaitingPayment });
}

export async function PATCH(request) {
  const denied = await requireAuth("bookings.write");
  if (denied) return denied;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ message: "That update didn't look right." }, { status: 400 });
  }

  const { id, status, note } = parsed.data;

  if (status) {
    const result = await setBookingStatus(id, status, { note: note?.trim() || undefined });
    if (!result.ok) {
      // A refusal here is usually "the batch filled up" — a 409, not a 500,
      // and the message is written to be read aloud to a customer.
      return Response.json({ message: result.message }, { status: 409 });
    }

    // Seats changed, so every page that quotes availability is now stale.
    if (holdsSeats(status) || holdsSeats(result.booking?.status)) {
      revalidatePath("/", "layout");
      revalidatePath(`/group-tours/${result.booking.tripSlug}`);
    }

    return Response.json({ booking: result.booking });
  }

  if (note?.trim()) {
    const booking = await addBookingNote(id, note.trim());
    if (!booking) return Response.json({ message: "No such booking." }, { status: 404 });
    return Response.json({ booking });
  }

  return Response.json({ message: "Nothing to change." }, { status: 400 });
}

export async function DELETE(request) {
  const denied = await requireAuth("bookings.write");
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ message: "No id." }, { status: 400 });

  // Deleting a booking that holds seats would strand them. Cancel first —
  // that returns the seats to the batch — then remove the record.
  const cancelled = await setBookingStatus(id, "cancelled");
  if (!cancelled.ok) return Response.json({ message: cancelled.message }, { status: 409 });

  const removed = await removeRecord(BOOKINGS, id);
  revalidatePath("/", "layout");
  return Response.json({ ok: removed });
}
