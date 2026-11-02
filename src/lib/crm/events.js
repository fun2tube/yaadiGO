import "server-only";

import { createRecord, listRecords } from "@/lib/cms/records";

/**
 * The spine.
 *
 * Every module — leads, quotations, bookings, payments, operations — records
 * what happened here, as an append-only fact. Nothing rewrites or deletes an
 * event. Records still hold current state because screens need to read it
 * cheaply, but the LOG is what the reports are built from.
 *
 * Why this matters for reporting: if each screen recomputes its own numbers
 * from mutable rows, they drift. Revenue on the dashboard stops matching
 * revenue on the salesperson's page, because one counts `booking.total` as it
 * is now and the other summed payments as they arrived, and a discount applied
 * last Tuesday is invisible to both. Derived from one ordered log, every
 * report answers from the same facts, and `reconcile()` can prove it.
 *
 * It is also how modules stay decoupled. A payment does not know that
 * operations exist; it emits `payment.received`, and whoever cares — the
 * booking's stage machine, the notification fan-out, the KPI roll-up —
 * subscribes. Adding a module means adding a subscriber, not editing five
 * call sites.
 */

export const EVENTS = "events";

const subscribers = new Map();

/**
 * Register a handler for an event type, or "*" for all of them.
 *
 * Handlers are deliberately fire-and-forget: a notification that fails to send
 * must never roll back the payment that triggered it. Failures are logged and
 * swallowed, and the event itself is already durable by the time they run.
 */
export function on(type, handler) {
  const list = subscribers.get(type) ?? [];
  list.push(handler);
  subscribers.set(type, list);
}

/**
 * Record that something happened, then tell everyone who cares.
 *
 * @param {string} type    e.g. "booking.confirmed" — dot-namespaced by module
 * @param {object} payload the facts, flat and self-describing
 * @param {object} meta    { actorId, actorName, leadId, quotationId, bookingId }
 *
 * The link fields on `meta` are what make cross-module reporting possible:
 * every event carries the whole chain it belongs to, so "revenue attributable
 * to the lead that came from the AI planner" is one filter rather than four
 * joins across files.
 */
export async function emit(type, payload = {}, meta = {}) {
  const event = await createRecord(EVENTS, {
    type,
    at: new Date().toISOString(),
    actorId: meta.actorId ?? null,
    actorName: meta.actorName ?? null,
    // The chain. Null where it does not apply.
    leadId: meta.leadId ?? null,
    quotationId: meta.quotationId ?? null,
    bookingId: meta.bookingId ?? null,
    // Denormalised so a report never has to load the lead to know who owned it
    // at the time. Ownership changes; history should not.
    ownerId: meta.ownerId ?? null,
    // Money moves are the ones reports care most about. Kept at the top level
    // rather than inside payload so summing never depends on event shape.
    amount: Number.isFinite(meta.amount) ? meta.amount : null,
    currency: meta.currency ?? "INR",
    payload,
  });

  const handlers = [...(subscribers.get(type) ?? []), ...(subscribers.get("*") ?? [])];
  for (const handler of handlers) {
    try {
      // Awaited rather than floated: on a serverless host the function can be
      // frozen the moment the response is sent, and a floated promise is then
      // silently dropped. These handlers are small.
      await handler(event);
    } catch (error) {
      console.error(`[crm] subscriber for "${type}" failed`, error);
    }
  }

  return event;
}

/** Every event, oldest first — the order reports depend on. */
export async function listEvents({ since, until, types, leadId, bookingId, ownerId } = {}) {
  const rows = await listRecords(EVENTS);
  const from = since ? new Date(since).getTime() : null;
  const to = until ? new Date(until).getTime() : null;
  const wanted = types ? new Set(types) : null;

  return rows
    .filter((event) => {
      const at = new Date(event.at ?? event.createdAt).getTime();
      if (from !== null && at < from) return false;
      if (to !== null && at > to) return false;
      if (wanted && !wanted.has(event.type)) return false;
      if (leadId && event.leadId !== leadId) return false;
      if (bookingId && event.bookingId !== bookingId) return false;
      if (ownerId && event.ownerId !== ownerId) return false;
      return true;
    })
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** The full history of one thing, for a timeline on its page. */
export async function timelineFor({ leadId, bookingId, quotationId }) {
  const rows = await listRecords(EVENTS);
  return rows
    .filter(
      (event) =>
        (leadId && event.leadId === leadId) ||
        (bookingId && event.bookingId === bookingId) ||
        (quotationId && event.quotationId === quotationId)
    )
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
