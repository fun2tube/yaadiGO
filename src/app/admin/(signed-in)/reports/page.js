import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { buildReport } from "@/lib/crm/reports";
import { userCan, money } from "@/lib/crm/schema";
import { PERIOD_OPTIONS, resolvePeriod } from "@/lib/crm/periods";
import BarChart from "@/components/cms/bar-chart";
import { AlertIcon, CheckIcon } from "@/components/icons";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const day = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function fmtMinutes(value) {
  if (value === null || value === undefined) return "—";
  if (value < 60) return `${value}m`;
  if (value < 1440) return `${Math.round(value / 60)}h`;
  return `${Math.round(value / 1440)}d`;
}

const num = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN"));
const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);

/**
 * Change against the previous period: arrow, sign and words — never colour
 * alone. `lowerIsBetter` for times (a faster reply is the good direction).
 */
function Delta({ value, lowerIsBetter = false }) {
  if (value === null || value === undefined) {
    return <span className="font-mono text-[10.5px] text-paper-text-faint">no comparison</span>;
  }
  if (value === 0) return <span className="font-mono text-[10.5px] text-paper-text-faint">→ same as before</span>;
  const up = value > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <span className={`font-mono text-[10.5px] font-bold ${good ? "text-good" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(value)}% vs previous
    </span>
  );
}

function Kpi({ label, value, delta, lowerIsBetter, sub }) {
  return (
    <div className="rounded-2xl border border-paper-line bg-card px-3.5 py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">{label}</p>
      <p className="mt-1 font-display text-[20px] font-bold leading-tight text-paper-text">{value}</p>
      <div className="mt-0.5">
        <Delta value={delta} lowerIsBetter={lowerIsBetter} />
      </div>
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

/**
 * Reports — sales performance and business growth.
 *
 * Any period (today → financial year, or custom), compared like-for-like with
 * the one before; the funnel from enquiry to money in; twelve months of trend;
 * a scorecard per salesperson; where business comes from and what people
 * want. Definitions are in lib/crm/analytics.js and match the quotation
 * register exactly. Rebuilt 2026-10-14 (docs/design/2026-10-14-media-quotes-reports.md).
 */
export default async function ReportsPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "reports.read")) redirect("/admin");

  const raw = (await searchParams) ?? {};
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const period = resolvePeriod(params.period ?? "month", { from: params.from, to: params.to });
  const report = await buildReport({ period });
  const h = report.headline;
  const d = report.deltas;

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
  const maxFunnel = Math.max(1, ...report.funnel.map((s) => s.count));

  return (
    <>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Reports</h1>
          <p className="mt-1 text-[13px] text-paper-text-muted">
            {report.period.label} · {day(report.period.since)} – {day(new Date(new Date(report.period.until).getTime() - 1))}, compared
            with {day(period.previous.since)} – {day(new Date(period.previous.until.getTime() - 1))}
          </p>
        </div>
        <a href={`/api/admin/reports/export${href({})}`} className="rounded-xl border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-bold text-paper-text">
          Download team CSV
        </a>
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

      {report.integrity.ok ? (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-good">
          <CheckIcon size={12} /> The records agree with each other.
        </p>
      ) : (
        <div className="mt-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-paper-text">
            <AlertIcon size={14} /> Check these before trusting the numbers
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {report.integrity.problems.map((p) => (
              <li key={p} className="text-[12.5px] text-paper-text-muted">
                · {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Headline */}
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label="Enquiries" value={num(h.enquiries)} delta={d.enquiries} />
        <Kpi label="Quotations sent" value={num(h.quotesSent)} delta={d.quotesSent} sub={`worth ${money(h.quotedValue)}`} />
        <Kpi label="Approved" value={money(h.approvedValue)} delta={d.approvedValue} sub={`${h.approvedCount} quotation${h.approvedCount === 1 ? "" : "s"}`} />
        <Kpi label="Booked" value={money(h.bookedValue)} delta={d.bookedValue} sub={`${h.bookings} booking${h.bookings === 1 ? "" : "s"}${h.averageDeal ? ` · avg ${money(h.averageDeal)}` : ""}`} />
        <Kpi label="Money received" value={money(h.collected)} delta={d.collected} sub="from the payments ledger" />
        <Kpi label="Win rate" value={pct(h.winRate)} delta={d.winRate} sub={`${h.won} won · ${h.lost} lost`} />
        <Kpi label="First reply (median)" value={fmtMinutes(h.firstResponseMedian)} delta={d.firstResponseMedian} lowerIsBetter />
        <Kpi label="Replied within an hour" value={pct(h.respondedWithinHour)} delta={d.respondedWithinHour} sub="of this period's enquiries" />
      </div>

      {/* Right now */}
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-paper-line bg-paper-dim p-3 text-[12.5px] sm:grid-cols-4">
        <p>
          <strong className="block font-display text-[16px] text-paper-text">{num(report.now.openLeads)}</strong>
          <span className="text-paper-text-muted">open leads now</span>
        </p>
        <p>
          <strong className="block font-display text-[16px] text-paper-text">{num(report.now.untouchedOverAnHour)}</strong>
          <span className="text-paper-text-muted">new, nobody has called in an hour</span>
        </p>
        <p>
          <strong className="block font-display text-[16px] text-paper-text">{money(report.now.openQuoteValue)}</strong>
          <span className="text-paper-text-muted">{report.now.openQuotes} quotations awaiting a decision</span>
        </p>
        <p>
          <strong className="block font-display text-[16px] text-paper-text">{money(report.now.outstanding)}</strong>
          <span className="text-paper-text-muted">still owed on live bookings</span>
        </p>
      </div>

      {/* Funnel */}
      <Section title="From enquiry to money" hint="This period's enquiries, and how far each has got so far.">
        <div className="flex flex-col gap-2 rounded-2xl border border-paper-line bg-card p-4">
          {report.funnel.map((step) => (
            <div key={step.key} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-[12.5px] sm:grid-cols-[160px_1fr_auto]">
              <span className="font-semibold text-paper-text">{step.label}</span>
              <span className="h-3 rounded-full bg-paper-dim" aria-hidden="true">
                <span className="block h-3 rounded-full bg-accent" style={{ width: `${(step.count / maxFunnel) * 100}%` }} />
              </span>
              <span className="whitespace-nowrap text-right font-mono text-[11px] text-paper-text-muted">
                <strong className="text-paper-text">{num(step.count)}</strong>
                {step.ofPrevious !== null ? ` · ${step.ofPrevious}% of the step before` : ""}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Trend */}
      <Section title="The last twelve months" hint="One measure per chart — counts and rupees are different scales.">
        <div className="grid gap-3 lg:grid-cols-2">
          <BarChart title="Enquiries" data={report.trend.map((t) => ({ key: t.key, label: t.label, value: t.enquiries }))} />
          <BarChart title="Quotations sent (₹)" format="money" data={report.trend.map((t) => ({ key: t.key, label: t.label, value: t.quotedValue }))} />
          <BarChart title="Booked (₹)" format="money" data={report.trend.map((t) => ({ key: t.key, label: t.label, value: t.bookedValue }))} />
          <BarChart title="Money received (₹)" format="money" data={report.trend.map((t) => ({ key: t.key, label: t.label, value: t.collected }))} />
        </div>
      </Section>

      {/* Team */}
      <Section title="The sales team" hint="Each person's own work in this period. A monthly target is scaled to the period's length.">
        {report.team.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-paper-line-strong p-6 text-center text-[13px] text-paper-text-muted">
            Nobody has any activity in this period.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-paper-line bg-card lg:block">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-paper-line font-mono text-[9.5px] uppercase tracking-[0.06em] text-paper-text-faint">
                    {["Salesperson", "Enquiries", "Open", "First reply", "Quotes", "Quoted", "Approved", "Booked", "Received", "Win rate", "Avg deal", "Target"].map((c, i) => (
                      <th key={c} className={`px-3 py-2 font-normal ${i > 0 ? "text-right" : ""}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.team.map((r) => (
                    <tr key={r.id} className="border-b border-paper-line last:border-b-0">
                      <td className="px-3 py-2.5 font-semibold text-paper-text">
                        {r.name}
                        {!r.active && <span className="ml-1.5 font-mono text-[9.5px] text-paper-text-faint">inactive</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">{num(r.assigned)}</td>
                      <td className="px-3 py-2.5 text-right">{num(r.open)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtMinutes(r.firstResponseMedian)}</td>
                      <td className="px-3 py-2.5 text-right">{num(r.quotesSent)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(r.quotedValue)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(r.approvedValue)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-paper-text">{money(r.bookedValue)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(r.collected)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {pct(r.winRate)} <span className="text-paper-text-faint">({r.won}/{r.won + r.lost})</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{r.averageDeal ? money(r.averageDeal) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{r.targetPercent !== null ? `${r.targetPercent}% of ${money(r.target)}` : "not set"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 lg:hidden">
              {report.team.map((r) => (
                <div key={r.id} className="rounded-2xl border border-paper-line bg-card px-4 py-3 text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[14px] font-bold text-paper-text">{r.name}</p>
                    <p className="font-display text-[15px] font-bold text-paper-text">{money(r.bookedValue)}</p>
                  </div>
                  <p className="mt-1 text-paper-text-muted">
                    {r.assigned} enquiries · {r.open} open · first reply {fmtMinutes(r.firstResponseMedian)}
                  </p>
                  <p className="text-paper-text-muted">
                    {r.quotesSent} quotes ({money(r.quotedValue)}) · approved {money(r.approvedValue)} · received {money(r.collected)}
                  </p>
                  <p className="text-paper-text-muted">
                    Win rate {pct(r.winRate)} · {r.targetPercent !== null ? `${r.targetPercent}% of target` : "no target set"}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Section title="Where business comes from" hint="Enquiries this period, and bookings made this period, by source.">
          <div className="overflow-hidden rounded-2xl border border-paper-line bg-card">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-paper-line font-mono text-[9.5px] uppercase text-paper-text-faint">
                  <th className="px-3 py-2 font-normal">Source</th>
                  <th className="px-3 py-2 text-right font-normal">Enquiries</th>
                  <th className="px-3 py-2 text-right font-normal">Bookings</th>
                  <th className="px-3 py-2 text-right font-normal">Booked</th>
                </tr>
              </thead>
              <tbody>
                {report.sources.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-paper-text-faint">
                      Nothing this period.
                    </td>
                  </tr>
                ) : (
                  report.sources.map((s) => (
                    <tr key={s.source} className="border-b border-paper-line last:border-b-0">
                      <td className="px-3 py-2 text-paper-text">{s.source}</td>
                      <td className="px-3 py-2 text-right">{num(s.enquiries)}</td>
                      <td className="px-3 py-2 text-right">{num(s.bookings)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(s.bookedValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="What people want" hint="Top destinations by booked value, then quoted value.">
          <div className="overflow-hidden rounded-2xl border border-paper-line bg-card">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-paper-line font-mono text-[9.5px] uppercase text-paper-text-faint">
                  <th className="px-3 py-2 font-normal">Destination</th>
                  <th className="px-3 py-2 text-right font-normal">Enquiries</th>
                  <th className="px-3 py-2 text-right font-normal">Quoted</th>
                  <th className="px-3 py-2 text-right font-normal">Booked</th>
                </tr>
              </thead>
              <tbody>
                {report.destinations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-paper-text-faint">
                      Nothing this period.
                    </td>
                  </tr>
                ) : (
                  report.destinations.map((x) => (
                    <tr key={x.destination} className="border-b border-paper-line last:border-b-0">
                      <td className="px-3 py-2 text-paper-text">{x.destination}</td>
                      <td className="px-3 py-2 text-right">{num(x.enquiries)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{money(x.quotedValue)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(x.bookedValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title="Why we lose">
        {report.lostReasons.length === 0 ? (
          <p className="text-[12.5px] text-paper-text-faint">Nothing lost in this period.</p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-2xl border border-paper-line bg-card p-4 text-[12.5px]">
            {report.lostReasons.map(([reason, count]) => (
              <li key={reason} className="flex justify-between gap-3">
                <span className="text-paper-text">{reason}</span>
                <span className="font-semibold text-paper-text">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
