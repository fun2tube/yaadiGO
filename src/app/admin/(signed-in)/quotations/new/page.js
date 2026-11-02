import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/cms/auth";
import { getLead } from "@/lib/crm/leads";
import { userCan } from "@/lib/crm/schema";
import QuoteBuilder from "@/components/cms/quote-builder";
import { ChevronIcon } from "@/components/icons";

export const metadata = { title: "New quotation" };
export const dynamic = "force-dynamic";

export default async function NewQuotationPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "quotations.write")) redirect("/admin");

  const params = await searchParams;
  const lead = params?.lead ? await getLead(params.lead) : null;
  // Set by the lead page's "Draft quotation" button, so that one tap lands
  // on a drafting quotation rather than an empty form.
  const autoDraft = params?.draft === "1";

  if (!lead) {
    return (
      <>
        <h1 className="font-display text-[24px] font-bold text-paper-text">New quotation</h1>
        <p className="mt-2 text-[14px] text-paper-text-muted">
          A quotation is always built against an enquiry, so the desk knows who it is for and the
          revenue lands on the right salesperson.
        </p>
        <Link
          href="/admin/quotations"
          className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-bold text-accent-deep"
        >
          Pick an enquiry <ChevronIcon size={12} />
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="mb-4">
        <Link
          href="/admin/quotations"
          className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text"
        >
          ← Quotations
        </Link>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-tight text-paper-text">
          Quote for {lead.name}
        </h1>
        <p className="mt-0.5 font-mono text-[11.5px] text-paper-text-faint">
          {[lead.destination, lead.dates, lead.groupSize ? `${lead.groupSize} travellers` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <QuoteBuilder lead={lead} autoDraft={autoDraft} />
    </>
  );
}
