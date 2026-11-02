/**
 * The quotation register — every quotation sent, who it went to, what it was
 * worth and what happened to it. Pure (records in, figures out) so the page,
 * the CSV export and the tests agree. See
 * docs/design/2026-10-14-media-quotes-reports.md.
 *
 * Counting rule, stated once because it decides every figure: a revision is a
 * new quotation (v2 replaces v1). COUNTS include every version sent — the desk
 * did send it — but VALUES count only the version still standing (anything
 * not superseded), so a customer quoted ₹1 lakh three times is ₹1 lakh of
 * business, not ₹3 lakh.
 */

import { buckets, bucketKey, inPeriod } from "@/lib/crm/periods";

export const REGISTER_STATUSES = [
  { value: "all", label: "All sent" },
  { value: "open", label: "Awaiting decision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Revised" },
  { value: "draft", label: "Drafts" },
];

function isExpired(q, now) {
  if (q.status === "expired") return true;
  return q.status === "sent" && q.validUntil && new Date(q.validUntil) < now;
}

function statusOf(q, now) {
  return isExpired(q, now) ? "expired" : q.status;
}

function matches(q, lead, query) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return true;
  const hay = [q.title, q.destination, lead?.name, lead?.phone, lead?.email, q.ownerName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[\s-]/g, "");
  return needle
    .replace(/[\s-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

const sum = (rows, pick) => rows.reduce((total, r) => total + (Number(pick(r)) || 0), 0);

/**
 * @param {object} input
 * @param {object[]} input.quotations
 * @param {object[]} input.leads
 * @param {object[]} input.users
 * @param {{since: Date, until: Date}} input.period
 * @param {{status?: string, ownerId?: string|null, query?: string}} [input.filters]
 * @param {string} [input.granularity]  day | week | month
 */
export function buildRegister({ quotations, leads, users, period, filters = {}, granularity = "day", now = new Date() }) {
  const leadById = new Map((leads ?? []).map((l) => [l.id, l]));
  const userById = new Map((users ?? []).map((u) => [u.id, u]));
  const { status = "all", ownerId = null, query = "" } = filters;

  const decorate = (q) => {
    const lead = leadById.get(q.leadId);
    const owner = userById.get(q.ownerId);
    return {
      id: q.id,
      leadId: q.leadId,
      version: q.version ?? 1,
      status: statusOf(q, now),
      title: q.title,
      destination: q.destination ?? null,
      travellers: q.travellers ?? null,
      total: q.total ?? 0,
      perPerson: q.perPerson ?? null,
      grossMargin: q.grossMargin ?? null,
      marginPercent: q.marginPercent ?? null,
      createdAt: q.createdAt ?? null,
      sentAt: q.sentAt ?? null,
      decidedAt: q.decidedAt ?? null,
      validUntil: q.validUntil ?? null,
      token: q.status === "draft" ? null : q.token ?? null,
      customerName: lead?.name ?? "—",
      customerPhone: lead?.phone ?? null,
      source: lead?.source ?? null,
      ownerId: q.ownerId ?? null,
      ownerName: owner?.name ?? owner?.email ?? q.createdByName ?? "—",
    };
  };

  const scoped = (quotations ?? []).filter(
    (q) => (!ownerId || q.ownerId === ownerId) && matches(q, leadById.get(q.leadId), query)
  );

  // Sent in the period: every version that went to a customer.
  const sent = scoped.filter((q) => q.status !== "draft" && inPeriod(q.sentAt, period)).map(decorate);
  const standing = sent.filter((r) => r.status !== "superseded");
  const drafts = scoped.filter((q) => q.status === "draft").map(decorate);

  const approved = standing.filter((r) => r.status === "approved");
  const rejected = standing.filter((r) => r.status === "rejected");
  const expired = standing.filter((r) => r.status === "expired");
  const open = standing.filter((r) => r.status === "sent");
  const decided = approved.length + rejected.length + expired.length;

  const kpis = {
    sentCount: sent.length,
    revisions: sent.length - standing.length,
    customers: new Set(sent.map((r) => r.leadId)).size,
    sentValue: sum(standing, (r) => r.total),
    averageValue: standing.length ? Math.round(sum(standing, (r) => r.total) / standing.length) : null,
    approvedCount: approved.length,
    approvedValue: sum(approved, (r) => r.total),
    rejectedCount: rejected.length,
    expiredCount: expired.length,
    openCount: open.length,
    openValue: sum(open, (r) => r.total),
    // Of the quotations that have an answer, how many said yes.
    winRate: decided ? Math.round((approved.length / decided) * 100) : null,
    draftCount: drafts.length,
    marginValue: sum(approved, (r) => r.grossMargin),
  };

  let rows;
  // Drafts are work in progress, not history: all of them, whatever the period.
  if (status === "draft") rows = drafts;
  else if (status === "open") rows = open;
  else if (status === "all") rows = sent;
  else rows = sent.filter((r) => r.status === status);
  rows = [...rows].sort((a, b) =>
    String(b.sentAt ?? b.createdAt ?? "").localeCompare(String(a.sentAt ?? a.createdAt ?? ""))
  );

  // One series per chart — count and value are different scales.
  const series = buckets(period.since, period.until, granularity).map((b) => ({ ...b, count: 0, value: 0, approvedValue: 0 }));
  const byKey = new Map(series.map((b) => [b.key, b]));
  for (const r of sent) {
    const bucket = byKey.get(bucketKey(r.sentAt, granularity));
    if (!bucket) continue;
    bucket.count += 1;
    if (r.status !== "superseded") bucket.value += r.total;
    if (r.status === "approved") bucket.approvedValue += r.total;
  }

  return { rows, kpis, series };
}

/** CSV for accounts and the owner's spreadsheet. `withMargin` only for managers. */
export function registerCsv(rows, { withMargin = false } = {}) {
  const head = [
    "Sent",
    "Customer",
    "Phone",
    "Quotation",
    "Version",
    "Status",
    "Destination",
    "Travellers",
    "Total (INR)",
    "Per person (INR)",
    ...(withMargin ? ["Margin (INR)", "Margin %"] : []),
    "Valid until",
    "Decided",
    "Salesperson",
    "Source",
  ];
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Leading = + - @ would run as a formula when opened in Excel.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const day = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const lines = rows.map((r) =>
    [
      day(r.sentAt ?? r.createdAt),
      r.customerName,
      r.customerPhone,
      r.title,
      r.version,
      r.status,
      r.destination,
      r.travellers,
      r.total,
      r.perPerson,
      ...(withMargin ? [r.grossMargin, r.marginPercent] : []),
      day(r.validUntil),
      day(r.decidedAt),
      r.ownerName,
      r.source,
    ]
      .map(cell)
      .join(",")
  );
  return [head.map(cell).join(","), ...lines].join("\n");
}
