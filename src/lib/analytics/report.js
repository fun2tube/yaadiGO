import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { change } from "@/lib/crm/periods";

/**
 * The Traffic report — and, through the agent later, the answer to "where is
 * our business coming from". Definitions, stated once:
 *
 *   VISITORS     distinct browsers (visitor ids) with a visit starting in the period
 *   VISITS       visits starting in the period (30 quiet minutes ends a visit)
 *   PAGEVIEWS    pages seen in those visits
 *   ENGAGED      median seconds a visit's pages were on screen, summed per visit
 *   ONE-PAGE     visits that saw a single page — the honest "bounce"
 *   ENQUIRIES    leads whose visit started in the period (leads.visit_id)
 *   CONVERSION   visits that produced at least one enquiry, over visits
 *   BOOKINGS     bookings, not cancelled, on those leads — and their value
 *
 * Attribution is the visit's channel: where the visitor came from on the
 * visit they enquired in. Days are IST.
 */

async function rows(db, query) {
  const result = await db.execute(query);
  return Array.isArray(result) ? result : (result.rows ?? []);
}

const n = (value) => (value === null || value === undefined ? 0 : Number(value));

async function headline(db, since, until) {
  const [row] = await rows(
    db,
    sql`
      with v as (
        select id, visitor_id, pageviews from visits
        where started_at >= ${since} and started_at < ${until}
      ),
      engaged as (
        select p.visit_id, sum(coalesce(p.duration_ms, 0)) as ms
        from pageviews p join v on v.id = p.visit_id
        group by p.visit_id
      ),
      enquiring as (
        select distinct l.visit_id from leads l join v on v.id = l.visit_id
      )
      select
        (select count(distinct visitor_id) from v) as visitors,
        (select count(*) from v) as visits,
        (select coalesce(sum(pageviews), 0) from v) as pageviews,
        (select count(*) from v where pageviews = 1) as one_page,
        (select percentile_cont(0.5) within group (order by ms) from engaged) as engaged_ms,
        (select count(*) from leads l join v on v.id = l.visit_id) as enquiries,
        (select count(*) from enquiring) as converting_visits
    `
  );
  const visits = n(row?.visits);
  return {
    visitors: n(row?.visitors),
    visits,
    pageviews: n(row?.pageviews),
    pagesPerVisit: visits ? Math.round((n(row?.pageviews) / visits) * 10) / 10 : null,
    onePagePct: visits ? Math.round((n(row?.one_page) / visits) * 100) : null,
    engagedSeconds: row?.engaged_ms === null || row?.engaged_ms === undefined ? null : Math.round(n(row.engaged_ms) / 1000),
    enquiries: n(row?.enquiries),
    conversionPct: visits ? Math.round((n(row?.converting_visits) / visits) * 1000) / 10 : null,
  };
}

export async function buildTrafficReport(period) {
  const db = getDb();
  if (!db) return { available: false };
  const { since, until } = period;

  const [now, before, daily, channels, sources, landing, pages, devices, events, campaigns, live] = await Promise.all([
    headline(db, since, until),
    headline(db, period.previous.since, period.previous.until),
    rows(
      db,
      sql`
        select to_char(v.started_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as day,
               count(distinct v.id) as visits,
               count(distinct v.visitor_id) as visitors,
               count(distinct l.id) as enquiries
        from visits v left join leads l on l.visit_id = v.id
        where v.started_at >= ${since} and v.started_at < ${until}
        group by 1 order by 1
      `
    ),
    rows(
      db,
      sql`
        -- Subtotals per visit first: joining leads and bookings straight onto
        -- visits would count a booking's value once per sibling lead.
        with per_visit as (
          select l.visit_id,
                 count(distinct l.id) as enquiries,
                 count(distinct b.id) as bookings,
                 coalesce(sum(b.total_paise), 0) as booked_paise
          from leads l
          left join bookings b on b.lead_id = l.id and b.status <> 'cancelled'
          where l.visit_id is not null
          group by l.visit_id
        )
        select v.channel,
               count(*) as visits,
               count(distinct v.visitor_id) as visitors,
               coalesce(sum(pv.enquiries), 0) as enquiries,
               coalesce(sum(pv.bookings), 0) as bookings,
               coalesce(sum(pv.booked_paise), 0) as booked_paise
        from visits v
        left join per_visit pv on pv.visit_id = v.id
        where v.started_at >= ${since} and v.started_at < ${until}
        group by v.channel
        order by visits desc
      `
    ),
    rows(
      db,
      sql`
        select v.source, v.channel, count(distinct v.id) as visits, count(distinct l.id) as enquiries
        from visits v left join leads l on l.visit_id = v.id
        where v.started_at >= ${since} and v.started_at < ${until}
        group by v.source, v.channel
        order by visits desc limit 15
      `
    ),
    rows(
      db,
      sql`
        select v.landing_path as path, count(distinct v.id) as visits, count(distinct l.id) as enquiries,
               round(100.0 * count(*) filter (where v.pageviews = 1) / nullif(count(*), 0)) as one_page_pct
        from visits v left join leads l on l.visit_id = v.id
        where v.started_at >= ${since} and v.started_at < ${until}
        group by v.landing_path
        order by visits desc limit 15
      `
    ),
    rows(
      db,
      sql`
        select p.path, count(*) as views, count(distinct p.visit_id) as visits,
               round(avg(p.duration_ms) filter (where p.duration_ms is not null) / 1000) as avg_seconds,
               round(avg(p.max_scroll) filter (where p.max_scroll is not null)) as avg_scroll
        from pageviews p
        where p.at >= ${since} and p.at < ${until}
        group by p.path
        order by views desc limit 20
      `
    ),
    rows(
      db,
      sql`
        select device, count(*) as visits from visits
        where started_at >= ${since} and started_at < ${until}
        group by device order by visits desc
      `
    ),
    rows(
      db,
      sql`
        select name, count(*) as count from site_events
        where at >= ${since} and at < ${until}
        group by name order by count desc
      `
    ),
    rows(
      db,
      sql`
        select v.utm_campaign as campaign, v.source, count(distinct v.id) as visits, count(distinct l.id) as enquiries
        from visits v left join leads l on l.visit_id = v.id
        where v.started_at >= ${since} and v.started_at < ${until} and v.utm_campaign is not null
        group by v.utm_campaign, v.source
        order by visits desc limit 10
      `
    ),
    rows(db, sql`select count(*) as visits from visits where last_seen_at > now() - interval '5 minutes'`),
  ]);

  return {
    available: true,
    headline: now,
    deltas: {
      visitors: change(now.visitors, before.visitors),
      visits: change(now.visits, before.visits),
      pageviews: change(now.pageviews, before.pageviews),
      enquiries: change(now.enquiries, before.enquiries),
      conversionPct: change(now.conversionPct, before.conversionPct),
      engagedSeconds: change(now.engagedSeconds, before.engagedSeconds),
    },
    daily: daily.map((r) => ({ day: r.day, visits: n(r.visits), visitors: n(r.visitors), enquiries: n(r.enquiries) })),
    channels: channels.map((r) => ({
      channel: r.channel,
      visits: n(r.visits),
      visitors: n(r.visitors),
      enquiries: n(r.enquiries),
      bookings: n(r.bookings),
      bookedPaise: n(r.booked_paise),
    })),
    sources: sources.map((r) => ({ source: r.source, channel: r.channel, visits: n(r.visits), enquiries: n(r.enquiries) })),
    landing: landing.map((r) => ({ path: r.path, visits: n(r.visits), enquiries: n(r.enquiries), onePagePct: n(r.one_page_pct) })),
    pages: pages.map((r) => ({
      path: r.path,
      views: n(r.views),
      visits: n(r.visits),
      avgSeconds: r.avg_seconds === null ? null : n(r.avg_seconds),
      avgScroll: r.avg_scroll === null ? null : n(r.avg_scroll),
    })),
    devices: devices.map((r) => ({ device: r.device, visits: n(r.visits) })),
    events: events.map((r) => ({ name: r.name, count: n(r.count) })),
    campaigns: campaigns.map((r) => ({ campaign: r.campaign, source: r.source, visits: n(r.visits), enquiries: n(r.enquiries) })),
    liveNow: n(live[0]?.visits),
  };
}
