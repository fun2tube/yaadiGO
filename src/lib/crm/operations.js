import "server-only";

import { createRecord, getRecord, listRecords, updateRecord, removeRecord } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { SERVICE_KIND_VALUES, SERVICE_STATUS_VALUES } from "@/lib/crm/schema";
import { emit } from "@/lib/crm/events";

/**
 * Operations — the things a trip is actually made of.
 *
 * A booking says a customer is going to Kerala for seven nights. It does not
 * say which hotel, which car, whose PNR, or whether any of it has been paid
 * for. That is this module, and until now it did not exist: the ops role had
 * permissions and no software.
 *
 * Two rules shape it:
 *
 *   PROGRESS COUNTS CONFIRMED ONLY. A hotel that has been emailed about is not
 *   a booked hotel. "5 of 7 arranged" must mean five things that will actually
 *   be there, or the number is worse than not having it.
 *
 *   SERVICES ARE CHEAP TO CREATE AND SLOW TO FILL IN. Ops adds "Hotel in
 *   Munnar" days before they know which hotel. Requiring a supplier and a
 *   reference up front would mean they keep the list in WhatsApp instead.
 */

export const SERVICES = "bookingServices";

/** Soonest first — the day a thing happens is how ops reads its own list. */
function byWhen(a, b) {
  const left = a.startsAt ?? a.createdAt ?? "";
  const right = b.startsAt ?? b.createdAt ?? "";
  return String(left).localeCompare(String(right));
}

export async function servicesFor(bookingId) {
  const rows = await listRecords(SERVICES);
  return rows.filter((s) => s.bookingId === bookingId).sort(byWhen);
}

/** confirmed ÷ total. Deliberately not "anything that is not todo". */
export function progressOf(services) {
  const live = services.filter((s) => s.status !== "cancelled");
  const confirmed = live.filter((s) => s.status === "confirmed").length;
  return {
    confirmed,
    total: live.length,
    outstanding: live.filter((s) => s.status !== "confirmed").length,
    percent: live.length === 0 ? 0 : Math.round((confirmed / live.length) * 100),
  };
}

export async function addService(bookingId, input, { actor } = {}) {
  const booking = await getRecord(BOOKINGS, bookingId);
  if (!booking) return { error: "No such booking." };

  if (!SERVICE_KIND_VALUES.includes(input.kind)) return { error: "Unknown service type." };
  if (!input.title?.trim()) return { error: "Give it a name." };

  const service = await createRecord(SERVICES, {
    bookingId,
    kind: input.kind,
    // Starts as "to arrange" unless ops says otherwise — the common case is
    // jotting down what still needs doing.
    status: SERVICE_STATUS_VALUES.includes(input.status) ? input.status : "todo",
    title: input.title.trim(),
    supplier: input.supplier?.trim() || null,
    reference: input.reference?.trim() || null,
    startsAt: input.startsAt || null,
    endsAt: input.endsAt || null,
    cost: Number(input.cost) || 0,
    note: input.note?.trim() || null,
    assignedToId: actor?.id ?? null,
  });

  return { service };
}

export async function updateService(id, patch, { actor } = {}) {
  const service = await getRecord(SERVICES, id);
  if (!service) return { error: "No such service." };

  const next = {};
  if (patch.title !== undefined) next.title = String(patch.title).trim();
  if (patch.supplier !== undefined) next.supplier = patch.supplier?.trim() || null;
  if (patch.reference !== undefined) next.reference = patch.reference?.trim() || null;
  if (patch.startsAt !== undefined) next.startsAt = patch.startsAt || null;
  if (patch.endsAt !== undefined) next.endsAt = patch.endsAt || null;
  if (patch.note !== undefined) next.note = patch.note?.trim() || null;
  if (patch.cost !== undefined) next.cost = Math.max(0, Number(patch.cost) || 0);

  if (patch.kind !== undefined) {
    if (!SERVICE_KIND_VALUES.includes(patch.kind)) return { error: "Unknown service type." };
    next.kind = patch.kind;
  }

  if (patch.status !== undefined) {
    if (!SERVICE_STATUS_VALUES.includes(patch.status)) return { error: "Unknown status." };
    next.status = patch.status;
  }

  const updated = await updateRecord(SERVICES, id, next);

  // Only a confirmation is worth an event. Ops edits a title or a note
  // constantly; a notification for each would train everyone to ignore the
  // bell, which is how a notification system dies.
  if (patch.status === "confirmed" && service.status !== "confirmed") {
    const booking = await getRecord(BOOKINGS, service.bookingId);
    await emit(
      "service.confirmed",
      {
        summary: `${updated.title}${updated.reference ? ` · ${updated.reference}` : ""}`,
        customerName: booking?.name ?? null,
        kind: updated.kind,
      },
      {
        bookingId: service.bookingId,
        leadId: booking?.leadId ?? null,
        ownerId: booking?.salesOwnerId ?? null,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? null,
      }
    );
  }

  return { service: updated };
}

export async function removeService(id) {
  const service = await getRecord(SERVICES, id);
  if (!service) return { error: "No such service." };
  await removeRecord(SERVICES, id);
  return { ok: true };
}

const DAY = 86400000;

/**
 * The board.
 *
 * Grouped by urgency rather than status, because "departs in four days with
 * three things unbooked" is the only ordering an ops desk actually uses. A
 * status-grouped list buries the thing that is about to go wrong.
 */
export async function buildOpsBoard({ opsOwnerId } = {}) {
  const [bookings, allServices] = await Promise.all([
    listRecords(BOOKINGS),
    listRecords(SERVICES),
  ]);

  const byBooking = new Map();
  for (const service of allServices) {
    const list = byBooking.get(service.bookingId) ?? [];
    list.push(service);
    byBooking.set(service.bookingId, list);
  }

  const handed = bookings
    .filter((b) => b.handedToOpsAt && b.status !== "cancelled")
    .filter((b) => !opsOwnerId || b.opsOwnerId === opsOwnerId)
    .map((booking) => {
      const services = (byBooking.get(booking.id) ?? []).sort(byWhen);
      const progress = progressOf(services);
      const start = booking.departureStart ? new Date(booking.departureStart).getTime() : null;
      const daysToGo = start === null ? null : Math.ceil((start - Date.now()) / DAY);

      return {
        ...booking,
        services,
        progress,
        daysToGo,
        outstanding: Math.max(0, (booking.total ?? 0) - (booking.collected ?? 0)),
      };
    });

  const soonest = (a, b) => (a.daysToGo ?? 9999) - (b.daysToGo ?? 9999);

  const done = handed.filter((b) => ["completed", "in-progress"].includes(b.status));
  const live = handed.filter((b) => !["completed", "in-progress"].includes(b.status));

  // A handed-over booking with NO departure date is its own problem: ops
  // cannot sequence anything against it, and it would otherwise fall silently
  // into "upcoming" and be forgotten. Customised bookings arrive this way,
  // because a quotation is approved before dates are pinned.
  const undated = live.filter((b) => b.daysToGo === null);

  const needsAttention = live
    .filter((b) => b.daysToGo !== null && b.daysToGo <= 14 && b.progress.outstanding > 0)
    .sort(soonest);

  const attentionIds = new Set([...needsAttention, ...undated].map((b) => b.id));
  const inProgress = live
    .filter((b) => !attentionIds.has(b.id) && b.progress.confirmed > 0 && b.progress.outstanding > 0)
    .sort(soonest);

  const progressIds = new Set(inProgress.map((b) => b.id));
  const upcoming = live
    .filter((b) => !attentionIds.has(b.id) && !progressIds.has(b.id))
    .sort(soonest);

  return {
    undated,
    needsAttention,
    inProgress,
    upcoming,
    travelling: done.sort(soonest),
    total: handed.length,
  };
}
