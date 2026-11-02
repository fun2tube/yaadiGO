import { notFound } from "next/navigation";
import { getQuotation } from "@/lib/crm/quotations";
import { customerContent } from "@/lib/crm/quote-view";
import { verifySignature } from "@/lib/pdf/sign";
import { SITE_URL } from "@/lib/site";
import QuotationDocument from "@/components/quote/templates";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * A quotation as the server's headless browser prints it.
 *
 * Not a page anyone visits: it answers only with a five-minute signature that
 * an endpoint mints after checking who is asking (lib/pdf/sign.js). Anything
 * else is a 404, which is also what a wrong id gets — nothing here says
 * whether a quotation exists.
 *
 * Same template, same blocks, same content as the customer's page. The
 * approve/decline control is replaced by the link to it, and a draft carries
 * a band so a file shared too early cannot pass for the final quotation.
 */
export default async function QuotationPdfPage({ params, searchParams }) {
  const { id } = await params;
  const { exp, sig } = await searchParams;
  if (!verifySignature("quotation", id, exp, sig)) notFound();

  const quotation = await getQuotation(id);
  if (!quotation) notFound();

  const content = await customerContent(quotation);

  return (
    <main data-pdf-ready className="bg-white">
      {quotation.status === "draft" && (
        <p className="mb-5 rounded-xl border border-warn/40 bg-warn-soft px-4 py-2.5 text-[12.5px] font-semibold text-paper-text">
          Draft — not yet sent to the customer. Prices and terms may still change.
        </p>
      )}

      <QuotationDocument quotation={quotation} content={content}>
        {quotation.status === "sent" && quotation.token && (
          <div className="print-block mt-7 rounded-2xl border border-paper-line bg-paper-dim p-5">
            <p className="text-[14px] font-bold text-paper-text">Approve it, or ask for changes, online</p>
            <p className="mt-1 break-all text-[13px] text-paper-text-muted">
              {`${SITE_URL}/q/${quotation.token}`}
            </p>
          </div>
        )}
      </QuotationDocument>
    </main>
  );
}
