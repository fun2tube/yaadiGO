import "server-only";

import { listUsers } from "@/lib/cms/users";
import { listLeads } from "@/lib/crm/leads";
import { listQuotations } from "@/lib/crm/quotations";
import { listBookings } from "@/lib/cms/bookings";
import { listEvents } from "@/lib/crm/events";
import { LEAD_STAGES, OPEN_LEAD_STAGES } from "@/lib/crm/schema";

/**
 * Reporting.
 *
 * Built from the event log wherever a number describes something that
 * HAPPENED, and from current records wherever it describes how things STAND.
 * That split is the whole reason the log exists:
 *
 *   "How many leads are open right now"      → records. It is a snapshot.
 *   "How much did Priya quote in September"  → events. A quotation edited or
 *                                              re-owned later must not silently
 *                                              rewrite last month's figure.
 *
 * Getting that backwards is how two screens end up disagreeing about revenue,
 * and why a dashboard nobody trusts stops being opened.
 */

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysBetween(a, b) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

/**
 * The pipeline as it stands, plus what moved in the period.
 *
 * @param {object} options
 * @param {Date}   options.since  defaults to the start of this month
 */
export async function buildReport({ since = startOfMonth(), until = new Date() } = {}) {
  const [users, leads, quotations, bookings, events] = await Promise.all([
    listUsers({ includeInactive: true }),
    listLeads(),
    listQuotations(),
    listBookings(),
    listEvents({ since, until }),
  ]);

  const byId = new Map(users.map((u) => [u.id, u]));
  const inPeriod = (iso) => {
    const t = new Date(iso).getTime();
    return t >= since.getTime() && t <= until.getTime();
  };

  // --- Pipeline, as it stands -------------------------------------------
  const pipeline = LEAD_STAGES.map((stage) => {
    const rows = leads.filter((l) => (l.status ?? "new") === stage.value);
    return {
      ...stage,
      count: rows.length,
      value: rows.reduce((sum, l) => sum + (l.value ?? 0), 0),
    };
  });

  const openLeads = leads.filter((l) => OPEN_LEAD_STAGES.includes(l.status ?? "new"));

  // --- What happened in the period --------------------------------------
  const created = events.filter((e) => e.type === "lead.created");
  const quotesSent = events.filter((e) => e.type === "quotation.sent");
  const approved = events.filter((e) => e.type === "quotation.approved");
  const paymentEvents = events.filter((e) => e.type === "payment.received");

  const wonInPeriod = leads.filter((l) => l.convertedAt && inPeriod(l.convertedAt));
  const lostInPeriod = leads.filter(
    (l) => l.status === "lost" && inPeriod(l.updatedAt ?? l.createdAt)
  );

  const decided = wonInPeriod.length + lostInPeriod.length;

  // --- Per salesperson ---------------------------------------------------
  const sellers = users.filter((u) => ["sales", "manager", "admin"].includes(u.role));

  const perPerson = sellers
    .map((user) => {
      const theirLeads = leads.filter((l) => l.ownerId === user.id);
      const theirOpen = theirLeads.filter((l) => OPEN_LEAD_STAGES.includes(l.status ?? "new"));
      const theirWon = theirLeads.filter((l) => l.convertedAt && inPeriod(l.convertedAt));
      const theirLost = theirLeads.filter(
        (l) => l.status === "lost" && inPeriod(l.updatedAt ?? l.createdAt)
      );

      // Attributed from the EVENT, not from the quotation's current owner —
      // reassigning an account next month must not move last month's numbers.
      const quoted = quotesSent
        .filter((e) => e.ownerId === user.id)
        .reduce((sum, e) => sum + (e.amount ?? 0), 0);

      const closedValue = theirWon.reduce((sum, l) => sum + (l.value ?? 0), 0);
      const theirDecided = theirWon.length + theirLost.length;

      const touched = theirLeads.filter((l) => l.convertedAt);
      const avgDays = touched.length
        ? Math.round(
            touched.reduce(
              (sum, l) => sum + daysBetween(l.receivedAt ?? l.createdAt, l.convertedAt),
              0
            ) / touched.length
          )
        : null;

      return {
        id: user.id,
        name: user.name ?? user.email,
        role: user.role,
        status: user.status,
        open: theirOpen.length,
        quotedValue: quoted,
        won: theirWon.length,
        lost: theirLost.length,
        closedValue,
        winRate: theirDecided ? Math.round((theirWon.length / theirDecided) * 100) : null,
        avgDaysToClose: avgDays,
        target: user.monthlyTarget ?? null,
      };
    })
    // Somebody with nothing at all is noise on the screen; an admin who does
    // not sell should not sit at the bottom of a sales table forever.
    .filter((row) => row.open || row.won || row.lost || row.quotedValue)
    .sort((a, b) => b.closedValue - a.closedValue);

  // --- Why we lose -------------------------------------------------------
  const lostReasons = {};
  for (const lead of lostInPeriod) {
    const reason = lead.lostReason ?? "Not recorded";
    lostReasons[reason] = (lostReasons[reason] ?? 0) + 1;
  }

  // --- Where leads come from --------------------------------------------
  const sources = {};
  for (const event of created) {
    const source = event.payload?.source ?? "unknown";
    sources[source] = (sources[source] ?? 0) + 1;
  }

  // --- Speed. The two numbers that change behaviour ----------------------
  //
  // Responding in under five minutes versus an hour is roughly a 10x
  // difference in conversion: travellers message four agents and buy from
  // whoever answers well first. It was previously invisible, which meant
  // nobody managed it.
  //
  // The MEDIAN flatters you and the p90 tells the truth — one lead ignored
  // overnight is the one that was lost, and an average hides it.
  const firstTouch = [];
  for (const lead of leads) {
    const born = new Date(lead.receivedAt ?? lead.createdAt).getTime();
    // Anything the desk did that the customer would notice.
    const touch = events.find(
      (e) =>
        e.leadId === lead.id &&
        ["lead.note", "lead.stage", "quotation.created", "quotation.sent"].includes(e.type)
    );
    if (!touch) continue;
    const minutes = Math.round((new Date(touch.at).getTime() - born) / 60000);
    if (minutes >= 0) firstTouch.push(minutes);
  }

  const percentile = (values, p) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  };

  // Enquiry to quotation sent. The second lever: the first good quote usually
  // wins, not the cheapest.
  const turnaround = [];
  for (const event of quotesSent) {
    const lead = leads.find((l) => l.id === event.leadId);
    if (!lead) continue;
    const hours =
      (new Date(event.at).getTime() - new Date(lead.receivedAt ?? lead.createdAt).getTime()) /
      3600000;
    if (hours >= 0) turnaround.push(Math.round(hours * 10) / 10);
  }

  const untouched = leads.filter(
    (l) =>
      (l.status ?? "new") === "new" &&
      Date.now() - new Date(l.receivedAt ?? l.createdAt).getTime() > 60 * 60 * 1000
  );

  const speed = {
    firstResponseMedian: percentile(firstTouch, 0.5),
    firstResponseP90: percentile(firstTouch, 0.9),
    quoteTurnaroundMedian: percentile(turnaround, 0.5),
    quoteTurnaroundP90: percentile(turnaround, 0.9),
    untouchedOverAnHour: untouched.length,
    sample: firstTouch.length,
  };

  const collected = paymentEvents.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const outstanding = bookings
    .filter((b) => !["cancelled", "completed"].includes(b.status))
    .reduce((sum, b) => sum + Math.max(0, (b.total ?? 0) - (b.collected ?? 0)), 0);

  return {
    period: { since: since.toISOString(), until: until.toISOString() },

    headline: {
      newLeads: created.length,
      openLeads: openLeads.length,
      quotesSent: quotesSent.length,
      quotedValue: quotesSent.reduce((sum, e) => sum + (e.amount ?? 0), 0),
      approved: approved.length,
      won: wonInPeriod.length,
      lost: lostInPeriod.length,
      winRate: decided ? Math.round((wonInPeriod.length / decided) * 100) : null,
      wonValue: wonInPeriod.reduce((sum, l) => sum + (l.value ?? 0), 0),
      collected,
      outstanding,
    },

    speed,
    pipeline,
    perPerson,
    lostReasons: Object.entries(lostReasons).sort((a, b) => b[1] - a[1]),
    sources: Object.entries(sources).sort((a, b) => b[1] - a[1]),

    // Surfaced rather than hidden: a report that cannot be reconciled should
    // say so on its own face instead of being quietly wrong.
    integrity: reconcile({ leads, quotations, bookings, events, byId }),
  };
}

/**
 * Does the log agree with the records?
 *
 * Anything listed here is a real inconsistency — an orphan, a missing event, a
 * lead marked won with no booking. Finding them is cheap; discovering them
 * from a customer is not.
 */
function reconcile({ leads, quotations, bookings, events }) {
  const problems = [];

  const leadIds = new Set(leads.map((l) => l.id));
  const orphanQuotes = quotations.filter((q) => !leadIds.has(q.leadId));
  if (orphanQuotes.length) {
    problems.push(`${orphanQuotes.length} quotation(s) point at a lead that no longer exists.`);
  }

  const unassigned = leads.filter(
    (l) => !l.ownerId && OPEN_LEAD_STAGES.includes(l.status ?? "new")
  );
  if (unassigned.length) {
    problems.push(`${unassigned.length} open lead(s) have no owner, so they belong to nobody.`);
  }

  const wonWithoutBooking = leads.filter(
    (l) => l.status === "won" && !bookings.some((b) => b.leadId === l.id)
  );
  if (wonWithoutBooking.length) {
    problems.push(`${wonWithoutBooking.length} lead(s) are marked won with no booking behind them.`);
  }

  const sentQuotes = quotations.filter((q) => q.status !== "draft");
  const sentEvents = new Set(events.filter((e) => e.type === "quotation.sent").map((e) => e.quotationId));
  const silentSends = sentQuotes.filter((q) => q.sentAt && !sentEvents.has(q.id));
  if (silentSends.length) {
    // Only meaningful within the reporting window; older sends are outside it.
    problems.push(
      `${silentSends.length} quotation(s) were sent without a matching event in this period.`
    );
  }

  return { ok: problems.length === 0, problems };
}
