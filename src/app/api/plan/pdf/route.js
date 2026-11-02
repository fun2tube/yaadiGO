import { ItinerarySchema } from "@/lib/planner";
import { renderPdf, renderOrigin, pdfFilename, pdfResponse, limitDownloads } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOWNLOADS_PER_HOUR = 20;
// A 21-day plan is ~25 KB of JSON. Anything near this is not an itinerary.
const MAX_BYTES = 200_000;

/**
 * The AI planner's itinerary as a PDF.
 *
 * The plan exists only in the visitor's browser, so it arrives in the body —
 * checked against the same schema the model writes to, then handed straight
 * to the render. Nothing is stored. React escapes every string it renders,
 * so a hand-crafted body can put words in the PDF but not markup or script.
 */
export async function POST(request) {
  const limited = limitDownloads(request, "plan-pdf", DOWNLOADS_PER_HOUR);
  if (limited) return limited;

  const raw = await request.text();
  if (raw.length > MAX_BYTES) {
    return Response.json({ message: "That plan is too large to print." }, { status: 413 });
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ message: "That didn't look like a trip plan." }, { status: 400 });
  }

  const parsed = ItinerarySchema.safeParse(body);
  if (!parsed.success || parsed.data.days.length === 0 || parsed.data.days.length > 30) {
    return Response.json({ message: "That didn't look like a trip plan." }, { status: 400 });
  }
  const itinerary = parsed.data;

  try {
    const pdf = await renderPdf({
      origin: renderOrigin(request),
      path: "/pdf/itinerary",
      inject: itinerary,
      title: `Trip plan · ${itinerary.title}`,
    });
    return pdfResponse(pdf, pdfFilename("YaadiGo", itinerary.title));
  } catch (error) {
    console.error("[pdf] itinerary", error);
    return Response.json(
      { message: "The PDF couldn't be made just now. Try again in a minute." },
      { status: 503 }
    );
  }
}
