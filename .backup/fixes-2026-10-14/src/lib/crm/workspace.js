import "server-only";

import { listRecords } from "@/lib/cms/records";
import { BOOKINGS } from "@/lib/cms/bookings";
import { listLeads } from "@/lib/crm/leads";
import { OPEN_LEAD_STAGES, LEAD_STAGE_VALUES } from "@/lib/crm/schema";
import { chaseListFrom } from "@/lib/crm/follow-ups";
import { QUOTATIONS } from "@/lib/crm/quotations";

/**
 * The sales workspace — "what do I do today".
 *
 * The inbox answered "what came in", which is not a salesperson's question.
 * Theirs is "who did I promise to ring today", and it was unanswerable because
 * nothing recorded when a lead was next due.
 *
 * Every number here is a filter, never a statistic. A count you cannot tap
 * through to the actual list is decoration.
 */

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Attach the money to each lead.
 *
 * The lead is where a salesperson lives, so "is this one paid" has to be
 * answerable without opening the booking. Done once here rather than per row
 * in the component.
 */
function withMoney(leads, bookings) {
  const byLead = new Map();
  for (const booking of bookings) {
    if (!booking.leadId) continue;
    const list = byLead.get(booking.leadId) ?? [];
    list.push(booking);
    byLead.set(booking.leadId, list);
  }

  return leads.map((lead) => {
    const theirs = (byLead.get(lead.id) ?? []).filter((b) => b.status !== "cancelled");
    const total = theirs.reduce((sum, b) => sum + (b.total ?? 0), 0);
    const collected = theirs.reduce((sum, b) => sum + (b.collected ?? 0), 0);

    return {
      ...lead,
      bookings: theirs,
      bookingTotal: total,
      collected,
      outstanding: Math.max(0, total - collected),
      // Three states, not two: no booking at all is different from a booking
      // with nothing owed, and the filter needs to tell them apart.
      money: theirs.length === 0 ? "none" : total - collected > 0 ? "pending" : "paid",
    };
  });
}

/** Overdue / today / tomorrow / later / none — from `followUpAt`. */
export function dueBucket(lead, now = new Date()) {
  if (!lead.followUpAt) return "none";
  const due = new Date(lead.followUpAt).getTime();
  if (due < startOfDay(now).getTime()) return "overdue";
  if (due <= endOfDay(now).getTime()) return "today";

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due <= endOfDay(tomorrow).getTime()) return "tomorrow";

  return "later";
}

/**
 * The day, for one person.
 *
 * `ownerId` scopes it. A salesperson sees their own work; a manager passing
 * null sees the whole desk.
 */
export async function buildMyDay({ ownerId } = {}) {
  // ONE parallel batch. Every table this page needs, fetched at the same time —
  // against a database 335ms away the round trips are the whole cost, and three
  // in parallel cost the same as one.
  const [leads, bookings, quotations] = await Promise.all([
    listLeads(),
    listRecords(BOOKINGS),
    listRecords(QUOTATIONS),
  ]);

  // Computed from what is already in memory: no further I/O.
  const chase = chaseListFrom(quotations, leads, { ownerId });

  const mine = withMoney(
    leads.filter((l) => (!ownerId || l.ownerId === ownerId) && OPEN_LEAD_STAGES.includes(l.status ?? "new")),
    bookings
  );

  const bucketed = { overdue: [], today: [], tomorrow: [], later: [], none: [] };
  for (const lead of mine) bucketed[dueBucket(lead)].push(lead);

  // Soonest first within each bucket; oldest-overdue first, because the lead
  // ignored longest is the one about to be lost.
  const byDue = (a, b) => String(a.followUpAt ?? "").localeCompare(String(b.followUpAt ?? ""));
  for (const key of Object.keys(bucketed)) bucketed[key].sort(byDue);

  const untouched = mine.filter((l) => (l.status ?? "new") === "new");
  const awaitingMoney = mine.filter((l) => l.money === "pending");

  return {
    ...bucketed,
    untouched,
    awaitingMoney,
    chase,
    counts: {
      chase: chase.length,
      overdue: bucketed.overdue.length,
      today: bucketed.today.length,
      tomorrow: bucketed.tomorrow.length,
      untouched: untouched.length,
      awaitingMoney: awaitingMoney.length,
      open: mine.length,
      // A lead with no next step is nobody's problem until it is everybody's.
      noFollowUp: bucketed.none.length,
    },
  };
}

/**
 * The filtered lead list.
 *
 * Filters combine. Everything is driven from the query string rather than
 * component state, so filtering, opening a lead and coming back does not lose
 * the view — which is most of what makes a list usable on a phone.
 */
export async function filterLeads({
  ownerId,
  stages,
  due,
  money,
  source,
  search,
  scopeToOwner,
} = {}) {
  const [leads, bookings] = await Promise.all([listLeads(), listRecords(BOOKINGS)]);

  let rows = withMoney(leads, bookings);

  // Scope is enforced here, not in the UI: a salesperson without team.read
  // must not be able to read a colleague's pipeline by editing the URL.
  //
  // UNASSIGNED leads are visible to everyone on purpose. A lead nobody owns is
  // precisely the one that must not be hidden — and hiding it in the list
  // while the detail page allowed it by URL was an inconsistency, not a rule.
  if (scopeToOwner) rows = rows.filter((l) => !l.ownerId || l.ownerId === scopeToOwner);
  else if (ownerId) rows = rows.filter((l) => l.ownerId === ownerId);

  if (stages?.length) {
    const wanted = new Set(stages.filter((s) => LEAD_STAGE_VALUES.includes(s)));
    if (wanted.size) rows = rows.filter((l) => wanted.has(l.status ?? "new"));
  }

  if (due && due !== "any") {
    if (due === "week") {
      rows = rows.filter((l) => ["overdue", "today", "tomorrow"].includes(dueBucket(l)) || (l.followUpAt && dueBucket(l) === "later" && new Date(l.followUpAt) - Date.now() < 7 * 86400000));
    } else {
      rows = rows.filter((l) => dueBucket(l) === due);
    }
  }

  if (money && money !== "any") rows = rows.filter((l) => l.money === money);
  if (source && source !== "any") rows = rows.filter((l) => l.source === source);

  if (search?.trim()) {
    const needle = search.trim().toLowerCase();
    rows = rows.filter((l) =>
      `${l.name ?? ""} ${l.phone ?? ""} ${l.email ?? ""} ${l.destination ?? ""} ${l.company ?? ""}`
        .toLowerCase()
        .includes(needle)
    );
  }

  return { leads: rows, total: leads.length, shown: rows.length };
}
