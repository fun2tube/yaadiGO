import "server-only";

import { listUsers } from "@/lib/cms/users";
import { listLeads } from "@/lib/crm/leads";
import { listQuotations } from "@/lib/crm/quotations";
import { listBookings } from "@/lib/cms/bookings";
import { listEvents } from "@/lib/crm/events";
import { listRecords } from "@/lib/cms/records";
import { PAYMENTS } from "@/lib/crm/payments";
import { OPEN_LEAD_STAGES } from "@/lib/crm/schema";
import { computeReport } from "@/lib/crm/analytics";
import { resolvePeriod, startOfIstMonth } from "@/lib/crm/periods";

/**
 * Reporting — the loader.
 *
 * The figures are computed in lib/crm/analytics.js (pure, tested); this file
 * only fetches the records they are computed from, and adds the integrity
 * check. Rebuilt 2026-10-14: the report used to show "this month so far" and
 * nothing else — no period, no comparison, no trend, no funnel.
 *
 * Built from records wherever a number describes how things STAND, and from
 * the event log for the one thing only the log knows: when the desk first
 * touched a lead.
 */
export async function buildReport({ period = resolvePeriod("month"), now = new Date() } = {}) {
  // Twelve months of events is enough for the trend and the response times.
  const eventsSince = new Date(startOfIstMonth(now).getTime() - 370 * 86400000);
  const earliest = period.previous.since < eventsSince ? period.previous.since : eventsSince;

  const [users, leads, quotations, bookings, payments, events] = await Promise.all([
    listUsers({ includeInactive: true }),
    listLeads(),
    listQuotations(),
    listBookings(),
    listRecords(PAYMENTS),
    listEvents({ since: earliest }),
  ]);

  const report = computeReport({ users, leads, quotations, bookings, payments: payments ?? [], events, period, now });

  // Surfaced rather than hidden: a report that cannot be reconciled should
  // say so on its own face instead of being quietly wrong.
  report.integrity = reconcile({ leads, quotations, bookings, payments: payments ?? [] });
  return report;
}

/**
 * Does everything agree with everything else?
 *
 * Anything listed here is a real inconsistency — an orphan, a lead marked won
 * with no booking, a booking whose running total disagrees with its ledger.
 * Finding them is cheap; discovering them from a customer is not.
 */
function reconcile({ leads, quotations, bookings, payments }) {
  const problems = [];

  const leadIds = new Set(leads.map((l) => l.id));
  const orphanQuotes = quotations.filter((q) => !leadIds.has(q.leadId));
  if (orphanQuotes.length) {
    problems.push(`${orphanQuotes.length} quotation(s) point at a lead that no longer exists.`);
  }

  const unassigned = leads.filter((l) => !l.ownerId && OPEN_LEAD_STAGES.includes(l.status ?? "new"));
  if (unassigned.length) {
    problems.push(`${unassigned.length} open lead(s) have no owner, so they belong to nobody.`);
  }

  const wonWithoutBooking = leads.filter((l) => l.status === "won" && !bookings.some((b) => b.leadId === l.id));
  if (wonWithoutBooking.length) {
    problems.push(`${wonWithoutBooking.length} lead(s) are marked won with no booking behind them.`);
  }

  // One live booking per lead (convert.js, 2026-10-14). Two means revenue is
  // counted twice somewhere.
  const live = bookings.filter((b) => !["cancelled", "completed"].includes(b.status) && b.leadId);
  const perLead = new Map();
  for (const b of live) perLead.set(b.leadId, (perLead.get(b.leadId) ?? 0) + 1);
  const doubled = [...perLead.values()].filter((n) => n > 1).length;
  if (doubled) {
    problems.push(`${doubled} lead(s) have more than one live booking — check for a duplicate before trusting booked value.`);
  }

  const ledger = new Map();
  for (const p of payments) ledger.set(p.bookingId, (ledger.get(p.bookingId) ?? 0) + (p.amount ?? 0));
  const drift = bookings.filter((b) => Math.round(ledger.get(b.id) ?? 0) !== Math.round(b.collected ?? 0));
  if (drift.length) {
    problems.push(`${drift.length} booking(s) show a collected amount that disagrees with their payments.`);
  }

  return { ok: problems.length === 0, problems };
}
