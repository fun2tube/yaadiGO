import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { listQuotations } from "@/lib/crm/quotations";
import { listLeads } from "@/lib/crm/leads";
import { userCan, QUOTE_STATUSES, TONE_CLASSES, money } from "@/lib/crm/schema";
import { ChevronIcon, SparkleIcon } from "@/components/icons";

export const metadata = { title: "Quotations" };
export const dynamic = "force-dynamic";

export default async function QuotationsPage() {
  const user = await currentUser();
  if (!userCan(user, "quotations.read")) redirect("/admin");

  const [quotations, leads] = await Promise.all([listQuotations(), listLeads()]);
  const byLead = new Map(leads.map((l) => [l.id, l]));

  // Leads worth quoting: spoken to, not yet won or lost, no quotation out.
  const quotedLeadIds = new Set(quotations.map((q) => q.leadId));
  const awaiting = leads.filter(
    (l) => !quotedLeadIds.has(l.id) && !["won", "lost", "new"].includes(l.status ?? "new")
  );

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Quotations
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Build one from an enquiry in about two minutes, then send it for approval.
        </p>
      </header>

      {awaiting.length > 0 && (
        <section className="mb-5">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Ready to quote
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {awaiting.slice(0, 6).map((lead) => (
              <Link
                key={lead.id}
                href={`/admin/quotations/new?lead=${lead.id}`}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-bold text-paper-text">{lead.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-paper-text-faint">
                    {[lead.destination, lead.dates, lead.groupSize ? `${lead.groupSize} pax` : null]
                      .filter(Boolean)
                      .join(" · ")}
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

      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        All quotations
      </h2>

      {quotations.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-paper-line-strong p-10 text-center text-[13.5px] text-paper-text-muted">
          None yet. Pick an enquiry above and the builder will draft one from it.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2.5">
          {quotations.map((q) => {
            const meta = QUOTE_STATUSES.find((s) => s.value === q.status) ?? QUOTE_STATUSES[0];
            const lead = byLead.get(q.leadId);
            return (
              <Link
                key={q.id}
                href={`/admin/quotations/${q.id}`}
                className="flex items-start justify-between gap-3 rounded-2xl border border-paper-line bg-card px-4 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-bold text-paper-text">{q.title}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${TONE_CLASSES[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] text-paper-text-faint">v{q.version}</span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-paper-text-faint">
                    {lead?.name ?? "—"} · {q.travellers} travellers
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-display text-[16px] font-bold text-paper-text">
                    {money(q.total)}
                  </span>
                  <ChevronIcon size={13} className="text-paper-text-faint" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
