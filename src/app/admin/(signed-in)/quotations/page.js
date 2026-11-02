import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { listQuotations } from "@/lib/crm/quotations";
import { listLeads } from "@/lib/crm/leads";
import { listUsers } from "@/lib/cms/users";
import { userCan, bookingScope, QUOTE_STATUSES, TONE_CLASSES, money } from "@/lib/crm/schema";
import { PERIOD_OPTIONS, granularityFor, resolvePeriod } from "@/lib/crm/periods";
import { REGISTER_STATUSES, buildRegister } from "@/lib/crm/register";
import BarChart from "@/components/cms/bar-chart";
import { ChevronIcon, SparkleIcon } from "@/components/icons";

export const metadata = { title: "Quotations" };
export const dynamic = "force-dynamic";

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—";

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-paper-line bg-card px-4 py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">{label}</p>
      <p className="mt-1 font-display text-[20px] font-bold leading-tight text-paper-text">{value}</p>
      {sub ? <p className="mt-0.5 text-[11.5px] text-paper-text-muted">{sub}</p> : null}
    </div>
  );
}

/**
 * The quotation register.
 *
 * Every quotation sent: to whom, by whom, for how much, and what happened —
 * for any day, week, month or custom range, with the totals and a chart of
 * value sent over time. Ops and admin can see it too (read-only for ops,
 * without cost or margin). Asked for 2026-10-14; it used to be a flat list of
 * titles. See docs/design/2026-10-14-media-quotes-reports.md.
 */
export default async function QuotationsPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "quotations.read")) redirect("/admin");

  // A repeated parameter arrives as an array; take the first.
  const raw = (await searchParams) ?? {};
  const params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const period = resolvePeriod(params.period ?? "30d", { from: params.from, to: params.to, fallback: "30d" });
  const granularity = ["day", "week", "month"].includes(params.by) ? params.by : granularityFor(period.days);
  const status = REGISTER_STATUSES.some((s) => s.value === params.status) ? params.status : "all";

  // A salesperson sees their own quotations; managers, ops and accounts see all.
  const scope = bookingScope(user);
  const seesTeam = scope === null;
  const ownerId = scope ?? (seesTeam && params.owner && params.owner !== "any" ? params.owner : null);
  const seesMargin = userCan(user, "team.read");
  const canWrite = userCan(user, "quotations.write");

  const [quotations, leads, users] = await Promise.all([listQuotations(), listLeads(), listUsers({ includeInactive: true })]);
  const { rows, kpis, series } = buildRegister({
    quotations,
    leads,
    users,
    period,
    granularity,
    filters: { status, ownerId, query: params.q ?? "" },
  });

  const sellers = users.filter((u) => quotations.some((q) => q.ownerId === u.id));

  // Leads worth quoting: spoken to, not yet won or lost, no quotation out.
  const quotedLeadIds = new Set(quotations.map((q) => q.leadId));
  const awaiting = canWrite
    ? leads.filter(
        (l) =>
          !quotedLeadIds.has(l.id) &&
          !["won", "lost", "new"].includes(l.status ?? "new") &&
          (seesTeam || l.ownerId === user.id)
      )
    : [];

  const query = (patch) => {
    const next = { period: period.key, status, q: params.q, owner: params.owner, by: params.by, from: params.from, to: params.to, ...patch };
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) usp.set(k, v);
    return `?${usp.toString()}`;
  };
  const csvHref = `/api/admin/quotations/export${query({})}`;

  const chip = (active) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
      active ? "border-ink bg-ink text-ink-text" : "border-paper-line-strong text-paper-text-muted hover:border-accent"
    }`;
  const fieldCls = "rounded-xl border border-paper-line-strong bg-card px-3 py-2 text-[13px] text-paper-text";

  return (
    <>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Quotations</h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
            Every quotation sent — to whom, by whom, for how much, and what happened. {seesTeam ? "Whole desk." : "Yours."}
          </p>
        </div>
        <a href={csvHref} className="rounded-xl border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-bold text-paper-text">
          Download CSV
        </a>
      </header>

      {/* Period */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PERIOD_OPTIONS.filter((p) => p.key !== "custom").map((p) => (
          <Link key={p.key} href={query({ period: p.key, from: null, to: null })} className={chip(period.key === p.key)}>
            {p.label}
          </Link>
        ))}
      </div>

      {/* Filters — a plain GET form, so a filtered register is a link you can share. */}
      <form method="get" className="mt-2.5 grid gap-2 rounded-2xl border border-paper-line bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input type="hidden" name="period" value={period.key} />
        <input name="q" defaultValue={params.q ?? ""} placeholder="Search customer, phone, destination…" className={fieldCls} />
        <select name="status" defaultValue={status} className={fieldCls}>
          {REGISTER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {seesTeam ? (
          <select name="owner" defaultValue={params.owner ?? "any"} className={fieldCls}>
            <option value="any">Everyone</option>
            {sellers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <button type="submit" className="rounded-xl bg-ink px-4 py-2 text-[13px] font-bold text-ink-text">
          Apply
        </button>
        {period.key === "custom" && (
          <>
            <input type="hidden" name="from" value={params.from ?? ""} />
            <input type="hidden" name="to" value={params.to ?? ""} />
          </>
        )}
      </form>

      <details className="mt-2" open={period.key === "custom"}>
        <summary className="cursor-pointer text-[12px] font-semibold text-paper-text-muted">Custom dates</summary>
        <form method="get" className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="period" value="custom" />
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          <input type="hidden" name="status" value={status} />
          {params.owner ? <input type="hidden" name="owner" value={params.owner} /> : null}
          <input type="date" name="from" required defaultValue={params.from ?? ""} className={fieldCls} />
          <span className="text-[12px] text-paper-text-faint">to</span>
          <input type="date" name="to" required defaultValue={params.to ?? ""} className={fieldCls} />
          <button type="submit" className="rounded-xl border border-paper-line-strong px-3 py-2 text-[12.5px] font-bold text-paper-text">
            Show these dates
          </button>
        </form>
      </details>

      <p className="mt-3 font-mono text-[11px] text-paper-text-faint">
        {period.label} · sent between {day(period.since)} and {day(new Date(period.until.getTime() - 1))}
      </p>

      {/* Headline */}
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          label="Quotations sent"
          value={kpis.sentCount.toLocaleString("en-IN")}
          sub={`${kpis.customers} customer${kpis.customers === 1 ? "" : "s"}${kpis.revisions ? ` · ${kpis.revisions} revision${kpis.revisions === 1 ? "" : "s"}` : ""}`}
        />
        <Kpi label="Worth" value={money(kpis.sentValue)} sub={kpis.averageValue ? `average ${money(kpis.averageValue)}` : "latest versions only"} />
        <Kpi
          label="Approved"
          value={money(kpis.approvedValue)}
          sub={`${kpis.approvedCount} approved${kpis.winRate !== null ? ` · ${kpis.winRate}% of decided` : ""}${seesMargin && kpis.marginValue ? ` · margin ${money(kpis.marginValue)}` : ""}`}
        />
        <Kpi label="Awaiting a decision" value={money(kpis.openValue)} sub={`${kpis.openCount} open · ${kpis.rejectedCount} declined · ${kpis.expiredCount} expired`} />
      </div>

      {/* Over time — value and count as two charts: different scales. */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <BarChart title={`Value sent, by ${granularity}`} data={series.map((b) => ({ key: b.key, label: b.label, value: b.value }))} format="money" />
        <BarChart title={`Quotations sent, by ${granularity}`} data={series.map((b) => ({ key: b.key, label: b.label, value: b.count }))} />
      </div>
      <div className="mt-2 flex gap-1.5">
        {["day", "week", "month"].map((g) => (
          <Link key={g} href={query({ by: g })} className={chip(granularity === g)}>
            By {g}
          </Link>
        ))}
      </div>

      {awaiting.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Ready to quote ({awaiting.length})
          </h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {awaiting.slice(0, 6).map((lead) => (
              <Link
                key={lead.id}
                href={`/admin/quotations/new?lead=${lead.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-paper-text">{lead.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-paper-text-faint">
                    {[lead.destination, lead.dates, lead.groupSize ? `${lead.groupSize} pax` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-accent-deep">
                  <SparkleIcon size={13} /> Quote
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The register */}
      <section className="mt-6">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          {REGISTER_STATUSES.find((s) => s.value === status)?.label} ({rows.length})
        </h2>

        {rows.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-paper-line-strong p-8 text-center text-[13px] text-paper-text-muted">
            No quotations match. Try a longer period or clear the search.
          </p>
        ) : (
          <>
            {/* Desktop: a real table. */}
            <div className="mt-2 hidden overflow-x-auto rounded-2xl border border-paper-line bg-card lg:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-paper-line font-mono text-[10px] uppercase tracking-[0.06em] text-paper-text-faint">
                    <th className="px-3 py-2 font-normal">Sent</th>
                    <th className="px-3 py-2 font-normal">Customer</th>
                    <th className="px-3 py-2 font-normal">Quotation</th>
                    <th className="px-3 py-2 font-normal">Status</th>
                    <th className="px-3 py-2 text-right font-normal">Value</th>
                    {seesMargin && <th className="px-3 py-2 text-right font-normal">Margin</th>}
                    <th className="px-3 py-2 font-normal">Valid to</th>
                    <th className="px-3 py-2 font-normal">Salesperson</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const meta = QUOTE_STATUSES.find((s) => s.value === r.status) ?? QUOTE_STATUSES[0];
                    return (
                      <tr key={r.id} className="border-b border-paper-line last:border-b-0 hover:bg-paper-dim">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-paper-text-muted">{day(r.sentAt ?? r.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/leads/${r.leadId}`} className="font-semibold text-paper-text hover:text-accent-deep">
                            {r.customerName}
                          </Link>
                          {r.customerPhone && <p className="font-mono text-[10.5px] text-paper-text-faint">{r.customerPhone}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/quotations/${r.id}`} className="text-paper-text hover:text-accent-deep">
                            {r.title}
                          </Link>
                          <span className="ml-1.5 font-mono text-[10px] text-paper-text-faint">v{r.version}</span>
                          <p className="font-mono text-[10.5px] text-paper-text-faint">
                            {[r.destination, r.travellers ? `${r.travellers} pax` : null].filter(Boolean).join(" · ")}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-paper-text">{money(r.total)}</td>
                        {seesMargin && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-paper-text-muted">
                            {r.marginPercent !== null && r.marginPercent !== undefined ? `${r.marginPercent}%` : "—"}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-paper-text-muted">{day(r.validUntil)}</td>
                        <td className="px-3 py-2.5 text-paper-text-muted">{r.ownerName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone: cards. */}
            <div className="mt-2 flex flex-col gap-2 lg:hidden">
              {rows.map((r) => {
                const meta = QUOTE_STATUSES.find((s) => s.value === r.status) ?? QUOTE_STATUSES[0];
                return (
                  <Link key={r.id} href={`/admin/quotations/${r.id}`} className="flex items-start justify-between gap-3 rounded-2xl border border-paper-line bg-card px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[14px] font-bold text-paper-text">{r.customerName}</span>
                        <span className={`rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] text-paper-text-muted">
                        {r.title} · v{r.version}
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">
                        {day(r.sentAt ?? r.createdAt)} · {r.ownerName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-display text-[15px] font-bold text-paper-text">{money(r.total)}</span>
                      <ChevronIcon size={13} className="text-paper-text-faint" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
