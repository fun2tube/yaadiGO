import { notFound } from "next/navigation";
import { getByToken } from "@/lib/crm/quotations";
import { customerContent } from "@/lib/crm/quote-view";
import QuotationDocument from "@/components/quote/templates";
import QuoteDecision from "@/components/cms/quote-decision";
import PdfDownloadButton from "@/components/pdf-download-button";

export const dynamic = "force-dynamic";

/**
 * The customer's copy.
 *
 * No session: the token IS the authorisation, which is why it is 24 random
 * bytes and why a draft's link does not resolve. Kept off search engines —
 * this is one person's pricing, not a page.
 */
export const metadata = { robots: { index: false, follow: false } };

export default async function CustomerQuotationPage({ params }) {
  const { token } = await params;
  const q = await getByToken(token);
  if (!q) notFound();

  // Content and the named owner — shared with the PDF (lib/crm/quote-view.js).
  const content = await customerContent(q);
  const decided = q.status === "approved" || q.status === "rejected";

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12 print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-4 flex justify-end">
        {/* A real file from the server, not the print dialog — see
            docs/design/pdf-downloads.md. */}
        <PdfDownloadButton
          href={`/api/q/${token}/pdf`}
          filename="YaadiGo-Quotation.pdf"
          className="rounded-xl border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-semibold text-paper-text-muted transition-colors hover:border-accent hover:text-paper-text"
        />
      </div>

      <QuotationDocument quotation={q} content={content}>
        {!decided && <QuoteDecision token={token} total={q.total} />}

        {decided && (
          <div
            className={`mt-7 rounded-2xl border p-5 ${
              q.status === "approved"
                ? "border-good/40 bg-good/10"
                : "border-paper-line bg-paper-dim"
            }`}
          >
            <p className="text-[14.5px] font-bold text-paper-text">
              {q.status === "approved"
                ? "You approved this quotation."
                : "You asked us to rework this."}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-paper-text-muted">
              {q.status === "approved"
                ? "A travel expert will call to confirm dates and take it from here."
                : "We will be in touch with a revised version."}
            </p>
          </div>
        )}
      </QuotationDocument>
    </main>
  );
}
