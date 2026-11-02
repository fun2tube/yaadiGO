import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan, money } from "@/lib/crm/schema";
import { PERIOD_OPTIONS, resolvePeriod, istDateKey } from "@/lib/crm/periods";
import { buildTrafficReport } from "@/lib/analytics/report";
import BarChart from "@/components/cms/bar-chart";

export const metadata = { title: "Traffic" };
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const day = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const num = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN"));
const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);
const rupees = (paise) => money(Math.round(Number(paise || 0) / 100));
const seconds = (s) => (s === null || s === undefined ? "—" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
const rate = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}%` : "—");

// Plain words for the owner; the codes are what the agent and the API use.
const CHANNEL = {
  organic: "Search (Google, Bing…)",
  ai: "AI assistants (ChatGPT, Perplexity…)",
  social: "Social & WhatsApp",
  paid: "Paid ads",
  email: "Email",
  referral: "Other websites",
  direct: "Direct (typed, bookmarks, apps)",
};
const EVENT = {
  enquiry_submitted: "Enquiries sent",
  whatsapp_clicked: "WhatsApp taps",
  call_clicked: "Call taps",
  email_clicked: "Email taps",
  outbound_clicked: "Links out to other sites",
};

function Delta({ value }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-[10.5px] text-paper-text-faint">no comparison</span>;
  }
  if (value === 0) return <span className="font-mono text-[10.5px] text-paper-text-faint">→ same as before</span>;
  const up = value > 0;
  return (
    <span className={`font-mono text-[10.5px] font-bold ${up ? "text-good" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(value)}% vs previous
    </span>
  );
}

function Kpi({ label, value, delta, sub }) {
  return (
    <div className="rounded-2xl border border-paper-line bg-card px-3.5 py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">{label}</p>
      <p className="mt-1 font-display text-[20px] font-bold leading-tight text-paper-text">{value}</p>
      {delta !== undefined ? (
        <div className="mt-0.5">
          <Delta value={delta} />
        </div>
      ) : null}
      {sub ? <p className="mt-0.5 text-[11px] text-paper-text-muted">{sub}</p> : null}
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="mt-7">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">{title}</h2>
      {hint ? <p className="mt-0.5 text-[12px] text-paper-text-faint">{hint}</p> : null}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** A plain table in a card; scrolls sideways on a phone rather than squashing. */
function Table({ head, rows, empty = "Nothing in this period yet." }) {
  if (!rows.length) return <p className="rounded-2xl border border-paper-line bg-card px-4 py-3 text-[12.5px] text-paper-text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-paper-line bg-card">
      <table className="w-full min-w-[520px] text-left text-[12.5px]">
        <thead>
          <tr className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-paper-text-faint">
            {head.map((h, i) => (
              <th key={h} className={`px-3.5 py-2 font-normal ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-t border-paper-line">
              {cells.map((cell, i) => (
                <td key={i} className={`px-3.5 py-2 ${i ? "text-right font-mono text-[11.5px] text-paper-text-muted" : "text-paper-text"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Daily points with the empty days filled in: a chart that skips days with
 * no visitors draws a busier week than there was. Monthly past three months.
 */
function series(period, daily, field) {
  const byDay = new Map(daily.map((d) => [d.day, d[field]]));
  const out = [];
  for (let t = period.since.getTime(); t < period.until.getTime(); t += DAY_MS) {
    const key = istDateKey(new Date(t));
    out.push({ key, label: day(new Date(t)), value: byDay.get(key) ?? 0 });
  }
  if (out.length <= 92) return out;
  const months = new Map();
  for (const point of out) {
    const key = point.key.slice(0, 7);
    const m = months.get(key) ?? { key, label: key, value: 0 };
    m.value += point.value;
    months.set(key, m);
  }
  return [...months.values()];
}

/**
 * Traffic: who comes to the website, from where, what they look at, and
 * which of them become enquiries and bookings. First-party and anonymous
 * (docs/design/ai-cofounder.md); definitions in lib/analytics/report.js.
 */
export default async function TrafficPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "reports.read")) redirect("/admin");

  const raw = (await searchParams) ?? {};
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const period = resolvePeriod(params.period ?? "7d", { from: params.from, to: params.to, fallback: "7d" });
  const report = await buildTrafficReport(period);

  const href = (patch) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries({ period: period.key, from: params.from, to: params.to, ...patch })) if (v) usp.set(k, v);
    return `?${usp.toString()}`;
  };
  const chip = (active) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
      active ? "border-ink bg-ink text-ink-text" : "border-paper-line-strong text-paper-text-muted hover:border-accent"
    }`;
  const fieldCls = "rounded-xl border border-paper-line-strong bg-card px-3 py-2 text-[13px] text-paper-text";

  if (!report.available) {
    return (
      <>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Traffic</h1>
        <p className="mt-3 text-[13px] text-paper-text-muted">Traffic needs the database, and this server has none configured.</p>
      </>
    );
  }

  const h = report.headline;
  const d = report.deltas;
  const totalDevices = report.devices.reduce((s, x) => s + x.visits, 0);

  return (
    <>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Traffic</h1>
          <p className="mt-1 text-[13px] text-paper-text-muted">
            {period.label} · {day(period.since)} – {day(new Date(period.until.getTime() - 1))}, compared with{" "}
            {day(period.previous.since)} – {day(new Date(period.previous.until.getTime() - 1))}
          </p>
        </div>
        <p className="flex items-center gap-2 rounded-full border border-paper-line bg-card px-3 py-1.5 text-[12.5px] text-paper-text">
          <span className={`h-2 w-2 rounded-full ${report.liveNow ? "bg-good" : "bg-paper-line-strong"}`} aria-hidden="true" />
          <strong>{num(report.liveNow)}</strong> on the site now
        </p>
      </header>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PERIOD_OPTIONS.filter((p) => p.key !== "custom").map((p) => (
          <Link key={p.key} href={href({ period: p.key, from: null, to: null })} className={chip(period.key === p.key)}>
            {p.label}
          </Link>
        ))}
      </div>
      <details className="mt-1.5" open={period.key === "custom"}>
        <summary className="cursor-pointer text-[12px] font-semibold text-paper-text-muted">Custom dates</summary>
        <form method="get" className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="period" value="custom" />
          <input type="date" name="from" required defaultValue={params.from ?? ""} className={fieldCls} />
          <span className="text-[12px] text-paper-text-faint">to</span>
          <input type="date" name="to" required defaultValue={params.to ?? ""} className={fieldCls} />
          <button type="submit" className="rounded-xl border border-paper-line-strong px-3 py-2 text-[12.5px] font-bold text-paper-text">
            Show
          </button>
        </form>
      </details>

      <p className="mt-3 text-[12px] text-paper-text-faint">
        Anonymous: no names, phones or IP addresses are kept with visits. Staff signed in to the admin are not counted.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Visitors" value={num(h.visitors)} delta={d.visitors} sub="different browsers" />
        <Kpi label="Visits" value={num(h.visits)} delta={d.visits} sub={h.pagesPerVisit ? `${h.pagesPerVisit} pages per visit` : null} />
        <Kpi label="Enquiries from the site" value={num(h.enquiries)} delta={d.enquiries} sub="leads tied to a visit" />
        <Kpi label="Visits that enquired" value={pct(h.conversionPct)} delta={d.conversionPct} />
        <Kpi label="Pages seen" value={num(h.pageviews)} delta={d.pageviews} />
        <Kpi label="Time on site (median)" value={seconds(h.engagedSeconds)} delta={d.engagedSeconds} sub="tab visible, per visit" />
        <Kpi label="Left after one page" value={pct(h.onePagePct)} sub="lower is better" />
        <Kpi
          label="On phones"
          value={rate(report.devices.find((x) => x.device === "mobile")?.visits ?? 0, totalDevices)}
          sub={`${num(totalDevices)} visits by device`}
        />
      </div>

      <Section title="Over time">
        <div className="grid gap-3 lg:grid-cols-2">
          <BarChart title="Visits" data={series(period, report.daily, "visits")} />
          <BarChart title="Enquiries from the site" data={series(period, report.daily, "enquiries")} />
        </div>
      </Section>

      <Section
        title="Where visitors come from"
        hint="Each visit is credited to how it arrived. Bookings are those still live on enquiries from these visits."
      >
        <Table
          head={["Channel", "Visits", "Visitors", "Enquiries", "Enquiry rate", "Bookings", "Booked"]}
          rows={report.channels.map((c) => [
            CHANNEL[c.channel] ?? c.channel,
            num(c.visits),
            num(c.visitors),
            num(c.enquiries),
            rate(c.enquiries, c.visits),
            num(c.bookings),
            c.bookedPaise ? rupees(c.bookedPaise) : "—",
          ])}
        />
      </Section>

      <Section title="Top sources">
        <Table
          head={["Source", "Channel", "Visits", "Enquiries"]}
          rows={report.sources.map((s) => [s.source, CHANNEL[s.channel]?.split(" (")[0] ?? s.channel, num(s.visits), num(s.enquiries)])}
        />
      </Section>

      <Section title="Where visits start" hint="The first page of each visit, and how often it was also the last.">
        <Table
          head={["Landing page", "Visits", "Enquiries", "Left after it"]}
          rows={report.landing.map((p) => [p.path, num(p.visits), num(p.enquiries), pct(p.onePagePct)])}
        />
      </Section>

      <Section title="Most viewed pages" hint="Time is how long the tab was visible; scroll is how far down people got, on average.">
        <Table
          head={["Page", "Views", "Visits", "Avg time", "Avg scroll"]}
          rows={report.pages.map((p) => [p.path, num(p.views), num(p.visits), seconds(p.avgSeconds), pct(p.avgScroll)])}
        />
      </Section>

      <div className="grid gap-x-4 lg:grid-cols-2">
        <Section title="What visitors did">
          <Table
            head={["Action", "Count"]}
            rows={report.events.map((e) => [EVENT[e.name] ?? e.name, num(e.count)])}
            empty="No taps or enquiries in this period yet."
          />
        </Section>
        <Section title="Campaigns" hint="Links tagged with utm_campaign.">
          <Table
            head={["Campaign", "Source", "Visits", "Enquiries"]}
            rows={report.campaigns.map((c) => [c.campaign, c.source, num(c.visits), num(c.enquiries)])}
            empty="No tagged campaign links in this period."
          />
        </Section>
      </div>
    </>
  );
}
