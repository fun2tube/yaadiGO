import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { getQuotation } from "@/lib/crm/quotations";
import { getLead } from "@/lib/crm/leads";
import { userCan, QUOTE_STATUSES, TONE_CLASSES, money } from "@/lib/crm/schema";
import QuoteBuilder from "@/components/cms/quote-builder";
import QuoteActions from "@/components/cms/quote-actions";
import QuotePresentation from "@/components/cms/quote-presentation";
import { defaultContent } from "@/lib/crm/quote-content";

export const metadata = { title: "Quotation" };
export const dynamic = "force-dynamic";

export default async function QuotationPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "quotations.read")) redirect("/admin");

  const { id } = await params;
  const quotation = await getQuotation(id);
  if (!quotation) notFound();

  const lead = await getLead(quotation.leadId);
  const meta = QUOTE_STATUSES.find((s) => s.value === quotation.status) ?? QUOTE_STATUSES[0];

  // A sent quotation is read-only. The price the customer approves has to be
  // the price they were shown, so revising means a new version rather than an
  // edit to the one in their inbox.
  const editable = quotation.status === "draft" && userCan(user, "quotations.write");

  return (
    <>
      <header className="mb-4">
        <Link
          href="/admin/quotations"
          className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text"
        >
          ← Quotations
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[24px] font-bold tracking-tight text-paper-text">
            {quotation.title}
          </h1>
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${TONE_CLASSES[meta.tone]}`}
          >
            {meta.label}
          </span>
          <span className="font-mono text-[10.5px] text-paper-text-faint">
            v{quotation.version}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[11.5px] text-paper-text-faint">
          {lead?.name ?? "—"} · {quotation.travellers} travellers · {money(quotation.total)}
        </p>
      </header>

      <QuoteActions quotation={quotation} canWrite={userCan(user, "quotations.write")} />

      {userCan(user, "quotations.write") && (
        <div className="mt-4">
          <QuotePresentation
            quotation={quotation}
            initialContent={{ ...defaultContent(quotation), ...(quotation.content ?? {}) }}
          />
        </div>
      )}

      {editable && lead ? (
        <div className="mt-5">
          <QuoteBuilder lead={lead} existing={quotation} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-paper-line bg-card p-4">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Lines
          </h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {quotation.lines.map((line, i) => (
              <div key={i} className="flex justify-between gap-4 text-[13.5px]">
                <span className="text-paper-text">
                  {line.label}
                  {line.perPerson ? (
                    <span className="ml-1.5 font-mono text-[10px] text-paper-text-faint">
                      per person
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-semibold text-paper-text">
                  {money(line.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-paper-line pt-3">
            <span className="font-bold text-paper-text">Total</span>
            <span className="font-display text-[18px] font-bold text-accent-deep">
              {money(quotation.total)}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
