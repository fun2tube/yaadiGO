import "server-only";

import { eq, sql } from "drizzle-orm";
import { requireDb } from "./index";
import { bookings, departures, events, payments } from "./schema";

/**
 * Seat inventory.
 *
 * The old file-based version did this:
 *
 *     read seatsLeft (6) → subtract 2 in JavaScript → write 4
 *
 * Two confirmations arriving together both read 6, both wrote 4, and the batch
 * was oversold by two. Nobody found out until the desk had to telephone a
 * customer and take a seat back.
 *
 * The fix is not a lock in application code. It is a single UPDATE whose WHERE
 * clause carries the condition, executed inside a transaction alongside the
 * booking and its event:
 *
 *     UPDATE departures SET seats_left = seats_left - $n
 *      WHERE id = $id AND seats_left >= $n
 *
 * Postgres serialises the row. The second writer sees the first one's result
 * and its WHERE fails, so it changes zero rows and we refuse the booking. The
 * CHECK constraint behind it is the backstop for any code path that forgets
 * to include the condition at all.
 */

export class InsufficientSeatsError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number
  ) {
    super(
      `Only ${available} seat${available === 1 ? "" : "s"} left on that batch, and ${requested} were asked for.`
    );
    this.name = "InsufficientSeatsError";
  }
}

/**
 * Take seats off a batch and confirm a booking, atomically.
 *
 * Either the seats move, the booking changes stage and the event is written —
 * or none of it happens. There is no ordering to get wrong, because there is
 * no second write to fail.
 */
export async function confirmBookingWithSeats({
  bookingId,
  actorId,
  actorName,
}: {
  bookingId: string;
  actorId?: string | null;
  actorName?: string | null;
}) {
  const db = requireDb();

  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) throw new Error("No such booking.");
    if (booking.status !== "requested") return { booking, seatsMoved: 0 };

    let seatsMoved = 0;

    // A customised booking has no departure and therefore no inventory.
    if (booking.departureId) {
      const need = booking.travellers;

      const moved = await tx
        .update(departures)
        .set({ seatsLeft: sql`${departures.seatsLeft} - ${need}`, updatedAt: new Date() })
        .where(sql`${departures.id} = ${booking.departureId} and ${departures.seatsLeft} >= ${need}`)
        .returning({ seatsLeft: departures.seatsLeft });

      if (moved.length === 0) {
        // Either the batch is gone or someone else took the seats first.
        // Read the current figure so the desk can say something true on the
        // phone rather than "it failed".
        const [current] = await tx
          .select({ seatsLeft: departures.seatsLeft })
          .from(departures)
          .where(eq(departures.id, booking.departureId))
          .limit(1);

        // Rolls back the whole transaction.
        throw new InsufficientSeatsError(current?.seatsLeft ?? 0, need);
      }

      seatsMoved = need;
    }

    const [updated] = await tx
      .update(bookings)
      .set({ status: "confirmed", seatsHeld: seatsMoved, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    // Same transaction as the change it describes. This is what makes the
    // event log trustworthy: a confirmed booking cannot exist without its
    // event, and an event cannot survive a rolled-back confirmation.
    await tx.insert(events).values({
      type: "booking.confirmed",
      actorId: actorId ?? null,
      actorName: actorName ?? null,
      leadId: booking.leadId,
      quotationId: booking.quotationId,
      bookingId: booking.id,
      ownerId: booking.salesOwnerId,
      amountPaise: booking.totalPaise,
      payload: {
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone,
        seatsHeld: seatsMoved,
        summary: `${booking.tripTitle} · ${booking.travellers} travellers`,
      },
    });

    return { booking: updated, seatsMoved };
  });
}

/** Give seats back. Cancelling must never fail on inventory. */
export async function releaseSeats({
  bookingId,
  actorId,
  actorName,
  reason,
}: {
  bookingId: string;
  actorId?: string | null;
  actorName?: string | null;
  reason?: string;
}) {
  const db = requireDb();

  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) throw new Error("No such booking.");

    if (booking.seatsHeld > 0 && booking.departureId) {
      // `least(...)` keeps the release inside seats_total, so a batch that was
      // shrunk while a booking was live cannot end up with more seats free
      // than it ever had — which the CHECK constraint would reject outright,
      // blocking a cancellation for a reason the desk cannot act on.
      await tx
        .update(departures)
        .set({
          seatsLeft: sql`least(${departures.seatsLeft} + ${booking.seatsHeld}, ${departures.seatsTotal})`,
          updatedAt: new Date(),
        })
        .where(eq(departures.id, booking.departureId));
    }

    const [updated] = await tx
      .update(bookings)
      .set({ status: "cancelled", seatsHeld: 0, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    await tx.insert(events).values({
      type: "booking.cancelled",
      actorId: actorId ?? null,
      actorName: actorName ?? null,
      leadId: booking.leadId,
      bookingId: booking.id,
      ownerId: booking.salesOwnerId,
      amountPaise: booking.totalPaise,
      payload: { seatsReturned: booking.seatsHeld, reason: reason ?? null },
    });

    return { booking: updated, seatsReturned: booking.seatsHeld };
  });
}

/**
 * Record a payment and move the booking's stage in one transaction.
 *
 * `collected_paise` is maintained here rather than summed from the payments
 * table on read. Both are correct; keeping a running total means the bookings
 * board does not aggregate a child table for every row it draws, and doing it
 * inside this transaction is what keeps the two from drifting.
 */
export async function recordPayment({
  bookingId,
  amountPaise,
  kind,
  method,
  reference,
  note,
  actorId,
  actorName,
}: {
  bookingId: string;
  amountPaise: bigint;
  kind: "advance" | "instalment" | "balance" | "refund";
  method: string;
  reference?: string | null;
  note?: string | null;
  actorId?: string | null;
  actorName?: string | null;
}) {
  const db = requireDb();

  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) throw new Error("No such booking.");

    const [payment] = await tx
      .insert(payments)
      .values({
        bookingId,
        kind,
        amountPaise,
        method,
        reference: reference ?? null,
        note: note ?? null,
        recordedById: actorId ?? null,
      })
      .returning();

    const collected = booking.collectedPaise + amountPaise;

    // Stage follows the money, but never walks backwards past a booking that
    // operations has already started working.
    const settled = collected >= booking.totalPaise && booking.totalPaise > 0n;
    const nextStatus =
      booking.status === "in-progress" || booking.status === "completed"
        ? booking.status
        : settled
          ? "paid"
          : collected > 0n
            ? "part-paid"
            : booking.status;

    const [updated] = await tx
      .update(bookings)
      .set({ collectedPaise: collected, status: nextStatus, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    await tx.insert(events).values({
      type: "payment.received",
      actorId: actorId ?? null,
      actorName: actorName ?? null,
      leadId: booking.leadId,
      bookingId: booking.id,
      ownerId: booking.salesOwnerId,
      amountPaise,
      payload: {
        kind,
        method,
        collectedPaise: collected.toString(),
        outstandingPaise: (booking.totalPaise - collected).toString(),
        customerName: booking.name,
      },
    });

    return { payment, booking: updated };
  });
}
