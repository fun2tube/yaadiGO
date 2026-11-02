/**
 * Reporting periods, in IST — browser-safe and pure.
 *
 * Every "today", "this week" and "this month" in the register and the reports
 * is the Delhi desk's calendar, not the server's (Vercel runs in UTC, so a
 * 9 p.m. quotation would otherwise land on tomorrow). Weeks start on Monday.
 *
 * A period is { key, label, since, until } with `until` exclusive, plus the
 * previous period of the same length for comparison.
 */

const IST_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The IST calendar date of an instant, as a UTC-midnight Date carrying y/m/d. */
function istParts(date) {
  const shifted = new Date(new Date(date).getTime() + IST_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate(), dow: shifted.getUTCDay() };
}

/** IST midnight of y-m-d, as a real instant. */
function istMidnight(y, m, d) {
  return new Date(Date.UTC(y, m, d) - IST_MS);
}

export function startOfIstDay(date = new Date()) {
  const { y, m, d } = istParts(date);
  return istMidnight(y, m, d);
}

export function startOfIstWeek(date = new Date()) {
  const { y, m, d, dow } = istParts(date);
  const back = (dow + 6) % 7; // Monday = 0
  return istMidnight(y, m, d - back);
}

export function startOfIstMonth(date = new Date()) {
  const { y, m } = istParts(date);
  return istMidnight(y, m, 1);
}

/** Indian financial year starts 1 April. */
export function startOfIstFinancialYear(date = new Date()) {
  const { y, m } = istParts(date);
  return istMidnight(m >= 3 ? y : y - 1, 3, 1);
}

export function startOfIstQuarter(date = new Date()) {
  const { y, m } = istParts(date);
  // Financial quarters: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar.
  const qStart = [0, 3, 6, 9].reduce((best, s) => (m >= s ? s : best), 0);
  return istMidnight(y, qStart, 1);
}

/** "2026-10-14" for an instant, on the IST calendar. */
export function istDateKey(date) {
  const { y, m, d } = istParts(date);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const [y, m, d] = value.split("-").map(Number);
  return istMidnight(y, m - 1, d);
}

export const PERIOD_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "week", label: "This week" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "fy", label: "This financial year" },
  { key: "custom", label: "Custom" },
];

/**
 * Resolve a period key (and, for "custom", from/to as YYYY-MM-DD, inclusive)
 * into instants. Unknown keys fall back to `fallback`.
 */
export function resolvePeriod(key, { from, to, now = new Date(), fallback = "month" } = {}) {
  const today = startOfIstDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  let since;
  let until = tomorrow;
  let label = PERIOD_OPTIONS.find((p) => p.key === key)?.label;

  switch (key) {
    case "today":
      since = today;
      break;
    case "7d":
      since = new Date(tomorrow.getTime() - 7 * DAY_MS);
      break;
    case "week":
      since = startOfIstWeek(now);
      break;
    case "30d":
      since = new Date(tomorrow.getTime() - 30 * DAY_MS);
      break;
    case "month":
      since = startOfIstMonth(now);
      break;
    case "last-month": {
      until = startOfIstMonth(now);
      since = startOfIstMonth(new Date(until.getTime() - DAY_MS));
      break;
    }
    case "quarter":
      since = startOfIstQuarter(now);
      break;
    case "fy":
      since = startOfIstFinancialYear(now);
      break;
    case "custom": {
      const a = parseDateInput(from);
      const b = parseDateInput(to);
      if (a && b && b >= a) {
        since = a;
        until = new Date(b.getTime() + DAY_MS);
        label = `${from} → ${to}`;
        break;
      }
      return resolvePeriod(fallback, { now });
    }
    default:
      return resolvePeriod(fallback, { now, fallback: "month" });
  }

  const length = until.getTime() - since.getTime();

  // Like for like. "This month" on the 14th compares with the 1st–14th of
  // last month, not with the fortnight before today; "this week" on a
  // Wednesday with last Monday–Wednesday. Rolling periods (7/30 days, today,
  // custom) compare with the stretch immediately before.
  let prevSince = new Date(since.getTime() - length);
  const { y, m, d } = istParts(since);
  if (key === "week") prevSince = istMidnight(y, m, d - 7);
  if (key === "month" || key === "last-month") prevSince = istMidnight(y, m - 1, 1);
  if (key === "quarter") prevSince = istMidnight(y, m - 3, 1);
  if (key === "fy") prevSince = istMidnight(y - 1, m, 1);
  // Never run the comparison into the current period (a 31-day month after
  // a 30-day one).
  const prevUntil = new Date(Math.min(prevSince.getTime() + length, since.getTime()));

  return {
    key,
    label,
    since,
    until,
    previous: { since: prevSince, until: prevUntil },
    days: Math.round(length / DAY_MS),
  };
}

export function inPeriod(iso, period) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= period.since.getTime() && t < period.until.getTime();
}

/** The bucket an instant falls in: "2026-10-14", "2026-W42" (week of 12 Oct), "2026-10". */
export function bucketKey(date, granularity) {
  if (granularity === "month") return istDateKey(startOfIstMonth(date)).slice(0, 7);
  if (granularity === "week") return `wk ${istDateKey(startOfIstWeek(date))}`;
  return istDateKey(date);
}

/** Every bucket from `since` to `until` (exclusive), in order, with a short label. */
export function buckets(since, until, granularity) {
  const out = [];
  let cursor =
    granularity === "month" ? startOfIstMonth(since) : granularity === "week" ? startOfIstWeek(since) : startOfIstDay(since);
  let guard = 0;
  while (cursor < until && guard++ < 400) {
    const key = bucketKey(cursor, granularity);
    const { y, m, d } = istParts(cursor);
    const month = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    out.push({
      key,
      start: cursor,
      label: granularity === "month" ? `${month} ${String(y).slice(2)}` : `${d} ${month}`,
    });
    if (granularity === "month") cursor = istMidnight(y, m + 1, 1);
    else cursor = istMidnight(y, m, d + (granularity === "week" ? 7 : 1));
  }
  return out;
}

/** Sensible bucket size for a period's length. */
export function granularityFor(days) {
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** Percentage change, or null when there is nothing to compare against. */
export function change(current, previous) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}
