import { ImageResponse } from "next/og";
import { getTourBySlug } from "@/lib/tours";
import { OgCard, OG_SIZE, OG_RESPONSE } from "@/components/og-card";

export const alt = "YaadiGo group tour";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug } = await params;
  const tour = getTourBySlug(slug);

  // Reads the static catalogue, not the CMS-merged `getTrip`. This route is
  // unauthenticated and crawler-facing: every WhatsApp forward, every Slack
  // unfurl and every bot sweep would otherwise put a database round trip
  // behind an image — and that database is currently 414 ms away (backlog
  // #35). A trip renamed in the editor keeps its original name on the share
  // card until the next deploy, which is the cheaper of the two problems.
  if (!tour) {
    return new ImageResponse(
      <OgCard eyebrow="Group tours" title="Fixed departures with real dates." />,
      OG_RESPONSE
    );
  }

  const meta = [tour.duration, `From ₹${tour.price.toLocaleString("en-IN")} per person`];
  if (tour.nextDeparture) meta.push(tour.nextDeparture);

  return new ImageResponse(
    <OgCard eyebrow="Group tour · fixed departure" title={tour.title} meta={meta} />,
    OG_RESPONSE
  );
}
