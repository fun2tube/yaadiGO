import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { getQuotation } from "@/lib/crm/quotations";
import { customerContent } from "@/lib/crm/quote-view";
import { userCan } from "@/lib/crm/schema";
import QuotationDocument from "@/components/quote/templates";

export const metadata = { title: "Preview quotation" };
export const dynamic = "force-dynamic";

/**
 * The customer's document, for staff, at any stage.
 *
 * "Preview what the customer sees" used to open the customer link
 * `/q/<token>` — which refuses drafts by design, and a draft is exactly when a
 * salesperson previews. So the button 404'd every time it mattered (reported
 * 2026-10-14). This page renders the same template and content behind the
 * staff session; the customer link keeps refusing drafts.
 */
export default async function QuotationPreviewPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "quotations.read")) redirect("/admin");

  const { id } = await params;
  const quotation = await getQuotation(id);
  if (!quotation) notFound();

  const content = await customerContent(quotation);
  const draft = quotation.status === "draft";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/admin/quotations/${quotation.id}`}
          className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text"
        >
          ← Back to the quotation
        </Link>
        {!draft && quotation.token && (
          <a
            href={`/q/${quotation.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] font-bold text-accent-deep"
          >
            Open the customer&apos;s own link ↗
          </a>
        )}
      </div>

      <p
        className={`mb-4 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold text-paper-text ${
          draft ? "border-warn/40 bg-warn/10" : "border-paper-line bg-card"
        }`}
      >
        {draft
          ? "Preview — this is a draft. The customer cannot see it until you send it."
          : `Preview — v${quotation.version}, ${quotation.status}. This is exactly what the customer's link shows, without the approve buttons.`}
      </p>

      <div className="rounded-2xl border border-paper-line bg-paper px-4 py-6 sm:px-8">
        <QuotationDocument quotation={quotation} content={content} />
      </div>
    </>
  );
}
