/**
 * The numbers behind Reports — pure: records in, figures out.
 *
 * Definitions, stated once, because a report nobody can explain is a report
 * nobody trusts:
 *
 *   ENQUIRIES      leads received in the period.
 *   QUOTES SENT    quotations sent in the period — the register's rule:
 *                  every version counts, value counts the version still
 *                  standing (lib/crm/register.js). Reports and the register
 *                  therefore always agree.
 *   APPROVED       quotations approved in the period (by decision date).
 *   BOOKED         bookings created in the period, not cancelled, at their
 *                  current value.
 *   COLLECTED      money in the payments ledger dated in the period,
 *                  refunds netted (they are negative).
 *   WIN RATE       of leads won or lost in the period, the share won.
 *   FUNNEL         a cohort: the leads received in the period, and how far
 *                  each has got so far.
 *
 * Every period is compared with the one immediately before it of the same
 * length. All dates are IST (lib/crm/periods.js).
 */

import { buckets, bucketKey, change, inPeriod, startOfIstMonth } from "@/lib/crm/periods";
import { buildRegister } from "@/lib/crm/register";

const OPEN = new Set(["new", "contacted", "qualified", "quoted", "negotiating"]);
const sum = (rows, pick) => rows.reduce((t, r) => t + (Number(pick(r)) || 0), 0);
const receivedAt = (l) => l.receivedAt ?? l.createdAt;

function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Minutes from enquiry to the desk's first visible action, per lead. */
function firstResponses(leads, events) {
  const firstTouch = new Map();
  for (const e of events) {
    if (!e.leadId || !["lead.note", "lead.stage", "lead.call", "quotation.created", "quotation.sent"].includes(e.type)) continue;
    const at = new Date(e.at).getTime();
    if (!firstTouch.has(e.leadId) || at < firstTouch.get(e.leadId)) firstTouch.set(e.leadId, at);
  }
  const out = new Map();
  for (const lead of leads) {
    const touch = firstTouch.get(lead.id);
    if (touch === undefined) continue;
    const minutes = Math.round((touch - new Date(receivedAt(lead)).getTime()) / 60000);
    if (minutes >= 0) out.set(lead.id, minutes);
  }
  return out;
}

/** The headline for one period. */
function headlineFor({ leads, quotations, bookings, payments, users, period, responses }) {
  const enquiries = leads.filter((l) => inPeriod(receivedAt(l), period));
  const register = buildRegister({ quotations, leads, users, period }).kpis;
  const approved = quotations.filter((q) => q.status === "approved" && inPeriod(q.decidedAt, period));
  const booked = bookings.filter((b) => b.status !== "cancelled" && inPeriod(b.createdAt, period));
  const collected = sum(payments.filter((p) => inPeriod(p.receivedAt, period)), (p) => p.amount);
  const won = leads.filter((l) => l.convertedAt && inPeriod(l.convertedAt, period));
  const lost = leads.filter((l) => l.status === "lost" && inPeriod(l.lostAt ?? l.updatedAt, period));
  const decided = won.length + lost.length;
  const times = enquiries.map((l) => responses.get(l.id)).filter((m) => m !== undefined);

  return {
    enquiries: enquiries.length,
    quotesSent: register.sentCount,
    quotedValue: register.sentValue,
    approvedCount: approved.length,
    approvedValue: sum(approved, (q) => q.total),
    bookings: booked.length,
    bookedValue: sum(booked, (b) => b.total),
    averageDeal: booked.length ? Math.round(sum(booked, (b) => b.total) / booked.length) : null,
    collected,
    won: won.length,
    lost: lost.length,
    winRate: decided ? Math.round((won.length / decided) * 100) : null,
    firstResponseMedian: median(times),
    respondedWithinHour: times.length ? Math.round((times.filter((m) => m <= 60).length / times.length) * 100) : null,
  };
}

/**
 * @param {object} input
 * @param {object[]} input.users
 * @param {object[]} input.leads
 * @param {object[]} input.quotations
 * @param {object[]} input.bookings
 * @param {object[]} input.payments
 * @param {object[]} input.events      at least everything since the trend start
 * @param {object}   input.period      from resolvePeriod()
 */
export function computeReport({ users = [], leads = [], quotations = [], bookings = [], payments = [], events = [], period, now = new Date(), trendMonths = 12 }) {
  const responses = firstResponses(leads, events);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const ctx = { leads, quotations, bookings, payments, users, responses };

  const current = headlineFor({ ...ctx, period });
  const previous = headlineFor({ ...ctx, period: period.previous });
  const deltas = Object.fromEntries(
    Object.keys(current).map((k) => [k, typeof current[k] === "number" && typeof previous[k] === "number" ? change(current[k], previous[k]) : null])
  );

  // --- Funnel: this period's enquiries, how far each has got ------------
  const cohort = leads.filter((l) => inPeriod(receivedAt(l), period));
  const cohortIds = new Set(cohort.map((l) => l.id));
  const sentFor = new Set(quotations.filter((q) => q.status !== "draft" && q.sentAt && cohortIds.has(q.leadId)).map((q) => q.leadId));
  const approvedFor = new Set(quotations.filter((q) => q.status === "approved" && cohortIds.has(q.leadId)).map((q) => q.leadId));
  const liveBookings = bookings.filter((b) => b.status !== "cancelled" && cohortIds.has(b.leadId));
  const bookedFor = new Set(liveBookings.map((b) => b.leadId));
  const paidFor = new Set(liveBookings.filter((b) => (b.collected ?? 0) > 0).map((b) => b.leadId));
  const contacted = cohort.filter((l) => (l.status ?? "new") !== "new" || responses.has(l.id) || sentFor.has(l.id));
  const funnel = [
    { key: "enquiries", label: "Enquiries", count: cohort.length },
    { key: "contacted", label: "Contacted", count: contacted.length },
    { key: "quoted", label: "Quotation sent", count: sentFor.size },
    { key: "approved", label: "Quotation approved", count: approvedFor.size },
    { key: "booked", label: "Booked", count: bookedFor.size },
    { key: "paid", label: "Money received", count: paidFor.size },
  ].map((step, i, all) => ({
    ...step,
    ofStart: all[0].count ? Math.round((step.count / all[0].count) * 100) : null,
    ofPrevious: i > 0 && all[i - 1].count ? Math.round((step.count / all[i - 1].count) * 100) : null,
  }));

  // --- Trend: the last N months, one series per measure -----------------
  const trendStart = startOfIstMonth(new Date(startOfIstMonth(now).getTime() - (trendMonths - 1) * 31 * 86400000));
  const trendEnd = period.until > now ? period.until : now;
  const months = buckets(trendStart, trendEnd, "month").slice(-trendMonths);
  const trend = months.map((m) => ({ key: m.key, label: m.label, enquiries: 0, quotedValue: 0, bookedValue: 0, collected: 0 }));
  const tByKey = new Map(trend.map((t) => [t.key, t]));
  const at = (iso) => (iso ? tByKey.get(bucketKey(iso, "month")) : null);
  for (const l of leads) {
    const t = at(receivedAt(l));
    if (t) t.enquiries += 1;
  }
  for (const q of quotations) {
    if (q.status === "draft" || q.status === "superseded" || !q.sentAt) continue;
    const t = at(q.sentAt);
    if (t) t.quotedValue += q.total ?? 0;
  }
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const t = at(b.createdAt);
    if (t) t.bookedValue += b.total ?? 0;
  }
  for (const p of payments) {
    const t = at(p.receivedAt);
    if (t) t.collected += p.amount ?? 0;
  }

  // --- The sales team ----------------------------------------------------
  const bookingOwner = (b) => b.salesOwnerId ?? leadById.get(b.leadId)?.ownerId ?? null;
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const sellers = users.filter(
    (u) => ["sales", "manager", "admin"].includes(u.role) || leads.some((l) => l.ownerId === u.id)
  );
  const team = sellers
    .map((u) => {
      const theirLeads = leads.filter((l) => l.ownerId === u.id);
      const assigned = theirLeads.filter((l) => inPeriod(receivedAt(l), period));
      const times = assigned.map((l) => responses.get(l.id)).filter((m) => m !== undefined);
      const reg = buildRegister({ quotations, leads, users, period, filters: { ownerId: u.id } }).kpis;
      const approved = quotations.filter((q) => q.ownerId === u.id && q.status === "approved" && inPeriod(q.decidedAt, period));
      const booked = bookings.filter((b) => bookingOwner(b) === u.id && b.status !== "cancelled" && inPeriod(b.createdAt, period));
      const collected = sum(
        payments.filter((p) => inPeriod(p.receivedAt, period) && bookingOwner(bookingById.get(p.bookingId) ?? {}) === u.id),
        (p) => p.amount
      );
      const won = theirLeads.filter((l) => l.convertedAt && inPeriod(l.convertedAt, period));
      const lost = theirLeads.filter((l) => l.status === "lost" && inPeriod(l.lostAt ?? l.updatedAt, period));
      const bookedValue = sum(booked, (b) => b.total);
      // A monthly target, scaled to the period's length.
      const target = u.monthlyTarget ? Math.round((u.monthlyTarget * period.days) / 30) : null;
      return {
        id: u.id,
        name: u.name ?? u.email,
        role: u.role,
        active: u.status === "active",
        assigned: assigned.length,
        open: theirLeads.filter((l) => OPEN.has(l.status ?? "new")).length,
        firstResponseMedian: median(times),
        quotesSent: reg.sentCount,
        quotedValue: reg.sentValue,
        approvedCount: approved.length,
        approvedValue: sum(approved, (q) => q.total),
        bookings: booked.length,
        bookedValue,
        collected,
        won: won.length,
        lost: lost.length,
        winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
        averageDeal: booked.length ? Math.round(bookedValue / booked.length) : null,
        target,
        targetPercent: target ? Math.round((bookedValue / target) * 100) : null,
      };
    })
    .filter((r) => r.assigned || r.open || r.quotesSent || r.bookings || r.collected || r.won || r.lost)
    .sort((a, b) => b.bookedValue - a.bookedValue || b.quotedValue - a.quotedValue);

  // --- Where business comes from ----------------------------------------
  const sourceRows = new Map();
  const src = (key) => {
    if (!sourceRows.has(key)) sourceRows.set(key, { source: key, enquiries: 0, bookings: 0, bookedValue: 0 });
    return sourceRows.get(key);
  };
  for (const l of cohort) src(l.source ?? "unknown").enquiries += 1;
  for (const b of bookings) {
    if (b.status === "cancelled" || !inPeriod(b.createdAt, period)) continue;
    const row = src(leadById.get(b.leadId)?.source ?? "unknown");
    row.bookings += 1;
    row.bookedValue += b.total ?? 0;
  }
  const sources = [...sourceRows.values()]
    .map((r) => ({ ...r, conversion: r.enquiries ? Math.round((r.bookings / r.enquiries) * 100) : null }))
    .sort((a, b) => b.bookedValue - a.bookedValue || b.enquiries - a.enquiries);

  // --- What people want --------------------------------------------------
  const destRows = new Map();
  const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ") || "Not given";
  const dest = (name) => {
    const key = norm(name).toLowerCase();
    if (!destRows.has(key)) destRows.set(key, { destination: norm(name), enquiries: 0, quotedValue: 0, bookedValue: 0 });
    return destRows.get(key);
  };
  for (const l of cohort) dest(l.destination).enquiries += 1;
  for (const q of quotations) {
    if (q.status === "draft" || q.status === "superseded" || !inPeriod(q.sentAt, period)) continue;
    dest(q.destination ?? leadById.get(q.leadId)?.destination).quotedValue += q.total ?? 0;
  }
  for (const b of bookings) {
    if (b.status === "cancelled" || !inPeriod(b.createdAt, period)) continue;
    dest(leadById.get(b.leadId)?.destination ?? b.tripTitle).bookedValue += b.total ?? 0;
  }
  const destinations = [...destRows.values()]
    .sort((a, b) => b.bookedValue - a.bookedValue || b.quotedValue - a.quotedValue || b.enquiries - a.enquiries)
    .slice(0, 12);

  // --- Why we lose -------------------------------------------------------
  const lostReasons = {};
  for (const l of leads) {
    if (l.status !== "lost" || !inPeriod(l.lostAt ?? l.updatedAt, period)) continue;
    const reason = l.lostReason ?? "Not recorded";
    lostReasons[reason] = (lostReasons[reason] ?? 0) + 1;
  }

  // --- Right now (not period-bound) --------------------------------------
  const outstanding = bookings
    .filter((b) => !["cancelled", "completed"].includes(b.status))
    .reduce((t, b) => t + Math.max(0, (b.total ?? 0) - (b.collected ?? 0)), 0);
  const openQuotes = quotations.filter((q) => q.status === "sent" && !(q.validUntil && new Date(q.validUntil) < now));
  const untouched = leads.filter(
    (l) => (l.status ?? "new") === "new" && now.getTime() - new Date(receivedAt(l)).getTime() > 3600000
  ).length;

  return {
    period: { key: period.key, label: period.label, since: period.since.toISOString(), until: period.until.toISOString(), days: period.days },
    headline: current,
    previous,
    deltas,
    funnel,
    trend,
    team,
    sources,
    destinations,
    lostReasons: Object.entries(lostReasons).sort((a, b) => b[1] - a[1]),
    now: {
      openLeads: leads.filter((l) => OPEN.has(l.status ?? "new")).length,
      untouchedOverAnHour: untouched,
      openQuotes: openQuotes.length,
      openQuoteValue: sum(openQuotes, (q) => q.total),
      outstanding,
    },
  };
}

/** The sales scorecard as CSV. */
export function teamCsv(team) {
  const head = [
    "Salesperson", "Enquiries assigned", "Open now", "First reply (median min)", "Quotes sent", "Quoted (INR)",
    "Approved", "Approved (INR)", "Bookings", "Booked (INR)", "Collected (INR)", "Won", "Lost", "Win rate %",
    "Average deal (INR)", "Target (INR)", "Target %",
  ];
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [
    head.join(","),
    ...team.map((r) =>
      [
        r.name, r.assigned, r.open, r.firstResponseMedian, r.quotesSent, r.quotedValue, r.approvedCount, r.approvedValue,
        r.bookings, r.bookedValue, r.collected, r.won, r.lost, r.winRate, r.averageDeal, r.target, r.targetPercent,
      ]
        .map(cell)
        .join(",")
    ),
  ].join("\n");
}
