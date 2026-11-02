import "@/lib/crm";
import { getByToken } from "@/lib/crm/quotations";
import { signedQuery } from "@/lib/pdf/sign";
import { renderPdf, renderOrigin, pdfFilename, pdfResponse, limitDownloads } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOWNLOADS_PER_HOUR = 20;

/**
 * The customer's copy as a PDF. The token is the credential, exactly as on
 * the page — only a sent (or answered) quotation resolves. Rate-limited,
 * because each request starts a browser render.
 */
export async function GET(request, { params }) {
  const limited = limitDownloads(request, "quote-pdf", DOWNLOADS_PER_HOUR);
  if (limited) return limited;

  const { token } = await params;
  const quotation = await getByToken(token);
  if (!quotation) return Response.json({ message: "This link is no longer valid." }, { status: 404 });

  try {
    const pdf = await renderPdf({
      origin: renderOrigin(request),
      path: `/pdf/quotation/${encodeURIComponent(quotation.id)}?${signedQuery("quotation", quotation.id)}`,
      title: `Quotation · ${quotation.title}`,
    });
    return pdfResponse(pdf, pdfFilename("YaadiGo Quotation", quotation.title));
  } catch (error) {
    console.error("[pdf] customer quotation", quotation.id, error);
    return Response.json(
      { message: "The PDF couldn't be made just now. Try again in a minute." },
      { status: 503 }
    );
  }
}
