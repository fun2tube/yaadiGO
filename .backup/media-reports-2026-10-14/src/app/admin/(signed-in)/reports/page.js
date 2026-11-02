import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { buildReport } from "@/lib/crm/reports";
import { userCan, TONE_CLASSES, money } from "@/lib/crm/schema";
import { AlertIcon, CheckIcon } from "@/components/icons";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function fmtMinutes(value) {
  if (value === null || value === undefined) return "—";
  if (value < 60) return `${value}m`;
  if (value < 1440) return `${Math.round(value / 60)}h`;
  return `${Math.round(value / 1440)}d`;
}

function fmtHours(value) {
  if (value === null || value === undefined) return "—";
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 48) return `${Math.round(value)}h`;
  return `${Math.round(value / 24)}d`;
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-paper-line bg-card p-3.5">
      <p
        className={`font-display text-[22px] font-bold leading-none ${
          tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : "text-paper-text"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-paper-text">{label}</p>
      {sub && <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">{sub}</p>}
    </div>
  );
}

export default async function ReportsPage() {
  const user = await currentUser();
  if (!userCan(user, "reports.read")) redirect("/admin");

  const report = await buildReport();
  const h = report.headline;
  const month = new Date(report.period.since).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const maxStage = Math.max(1, ...report.pipeline.map((s) => s.count));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Reports
        </h1>
        <p className="mt-1 text-[13.5px] text-paper-text-muted">{month} so far</p>
      </header>

      {/* Reconciliation first. A report that cannot be trusted should say so
          before it shows a single number. */}
      {report.integrity.ok ? (
        <p className="mb-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-good">
          <CheckIcon size={13} /> The log and the records agree.
        </p>
      ) : (
        <div className="mb-4 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-paper-text">
            <span className="text-warn">
              <AlertIcon size={13} />
            </span>
            These numbers do not fully reconcile
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {report.integrity.problems.map((p) => (
              <li key={p} className="text-[12.5px] leading-snug text-paper-text-muted">
                · {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="New enquiries" value={h.newLeads} sub="this month" />
        <Stat label="Open now" value={h.openLeads} sub="need working" />
        <Stat
          label="Quoted"
          value={money(h.quotedValue)}
          sub={`${h.quotesSent} sent`}
        />
        <Stat
          label="Won"
          value={money(h.wonValue)}
          sub={`${h.won} of ${h.won + h.lost}`}
          tone="good"
        />
        <Stat
          label="Win rate"
          value={h.winRate === null ? "—" : `${h.winRate}%`}
          sub={h.winRate === null ? "nothing closed yet" : "of decided leads"}
        />
        <Stat label="Collected" value={money(h.collected)} sub="this month" tone="good" />
        <Stat
          label="Outstanding"
          value={money(h.outstanding)}
          sub="across live bookings"
          tone={h.outstanding > 0 ? "warn" : undefined}
        />
        <Stat label="Approved" value={h.approved} sub="quotations" />
      </div>

      {/* Speed. Put high on the page because it is the lever that moves
          conversion most and the one nobody looks at. */}
      <section className="mt-7">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          How fast we answer
        </h2>
        {report.speed.sample === 0 ? (
          <p className="mt-2.5 rounded-2xl border border-dashed border-paper-line-strong p-6 text-center text-[13px] text-paper-text-muted">
            Nothing worked yet this month. These fill in as the desk touches leads.
          </p>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat
              label="First reply (median)"
              value={fmtMinutes(report.speed.firstResponseMedian)}
              sub={`${report.speed.sample} leads`}
              tone={report.speed.firstResponseMedian <= 15 ? "good" : "warn"}
            />
            <Stat
              label="First reply (p90)"
              value={fmtMinutes(report.speed.firstResponseP90)}
              sub="the slow tail"
              tone={report.speed.firstResponseP90 <= 60 ? "good" : "warn"}
            />
            <Stat
              label="Quote sent (median)"
              value={fmtHours(report.speed.quoteTurnaroundMedian)}
              sub="from enquiry"
            />
            <Stat
              label="Untouched >1h"
              value={report.speed.untouchedOverAnHour}
              sub="nobody has called"
              tone={report.speed.untouchedOverAnHour > 0 ? "warn" : "good"}
            />
          </div>
        )}
      </section>

      {/* Pipeline */}
      <section className="mt-7">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          Pipeline right now
        </h2>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {report.pipeline.map((stage) => (
            <div key={stage.value} className="flex items-center gap-3">
              <span className="w-[86px] shrink-0 text-[12.5px] font-semibold text-paper-text">
                {stage.label}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-paper-dim">
                <div
                  className={`h-full ${TONE_CLASSES[stage.tone]}`}
                  style={{ width: `${Math.round((stage.count / maxStage) * 100)}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[12px] text-paper-text-muted">
                {stage.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Per salesperson */}
      <section className="mt-7">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          By salesperson
        </h2>
        {report.perPerson.length === 0 ? (
          <p className="mt-2.5 rounded-2xl border border-dashed border-paper-line-strong p-8 text-center text-[13px] text-paper-text-muted">
            Nothing attributed yet. Numbers appear here as soon as enquiries are assigned.
          </p>
        ) : (
          <div className="mt-2.5 flex flex-col gap-2">
            {report.perPerson.map((row) => (
              <article key={row.id} className="rounded-2xl border border-paper-line bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-bold text-paper-text">{row.name}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">
                      {row.open} open · {row.won} won · {row.lost} lost
                      {row.avgDaysToClose !== null ? ` · ~${row.avgDaysToClose}d to close` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-[17px] font-bold text-paper-text">
                      {money(row.closedValue)}
                    </p>
                    <p className="font-mono text-[10px] text-paper-text-faint">closed</p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]">
                  <span className="text-paper-text-muted">
                    Quoted <strong className="font-semibold text-paper-text">{money(row.quotedValue)}</strong>
                  </span>
                  <span className="text-paper-text-muted">
                    Win rate{" "}
                    <strong className="font-semibold text-paper-text">
                      {row.winRate === null ? "—" : `${row.winRate}%`}
                    </strong>
                  </span>
                </div>

                {/* Only drawn when a target exists. A bar against a target
                    nobody set reads as 0% of something real. */}
                {row.target ? (
                  <div className="mt-2.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper-dim">
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: `${Math.min(100, Math.round((row.closedValue / row.target) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-paper-text-faint">
                      {Math.round((row.closedValue / row.target) * 100)}% of {money(row.target)}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Where leads come from, and why we lose them */}
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <section>
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Where enquiries came from
          </h2>
          {report.sources.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-paper-text-muted">Nothing this month.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {report.sources.map(([source, count]) => (
                <li key={source} className="flex justify-between text-[13px]">
                  <span className="text-paper-text">{source}</span>
                  <span className="font-mono text-paper-text-muted">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Why we lost
          </h2>
          {report.lostReasons.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-paper-text-muted">Nothing lost this month.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {report.lostReasons.map(([reason, count]) => (
                <li key={reason} className="flex justify-between text-[13px]">
                  <span className="text-paper-text">{reason}</span>
                  <span className="font-mono text-paper-text-muted">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
