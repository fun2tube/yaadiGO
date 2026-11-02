import ItineraryDocument from "@/components/planner/itinerary-document";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A trip plan as the server's headless browser prints it. The plan is
 * injected into the page by lib/pdf/render.js — see ItineraryDocument.
 */
export default function ItineraryPdfPage() {
  return (
    <main className="bg-white">
      <ItineraryDocument />
    </main>
  );
}
