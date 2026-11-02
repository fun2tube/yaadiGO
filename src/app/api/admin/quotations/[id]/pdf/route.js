import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { getQuotation } from "@/lib/crm/quotations";
import { signedQuery } from "@/lib/pdf/sign";
import { renderPdf, renderOrigin, pdfFilename, pdfResponse, PdfUnavailableError } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";
// A cold start launches Chromium (2–4 s) before the render itself.
export const maxDuration = 60;

/**
 * A quotation as a PDF, for the desk — drafts included, so a salesperson can
 * send the file on WhatsApp before (or instead of) the link. Same permission
 * as opening the quotation in the admin.
 */
export async function GET(request, { params }) {
  const { denied } = await authorise("quotations.read");
  if (denied) return denied;

  const { id } = await params;
  const quotation = await getQuotation(id);
  if (!quotation) return Response.json({ message: "No such quotation." }, { status: 404 });

  try {
    const pdf = await renderPdf({
      origin: renderOrigin(request),
      path: `/pdf/quotation/${encodeURIComponent(id)}?${signedQuery("quotation", id)}`,
      title: `Quotation · ${quotation.title}`,
    });
    return pdfResponse(
      pdf,
      pdfFilename("YaadiGo Quotation", quotation.title, `v${quotation.version}`, quotation.status === "draft" && "DRAFT")
    );
  } catch (error) {
    console.error("[pdf] admin quotation", id, error);
    const message =
      error instanceof PdfUnavailableError
        ? error.message
        : "The PDF couldn't be made just now. Try again in a minute.";
    return Response.json({ message }, { status: 503 });
  }
}
