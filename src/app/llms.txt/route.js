import { getDestinations, getTrips } from "@/lib/cms/catalogue";
import { sortedPosts } from "@/lib/posts";
import { SITE_URL, SITE_NAME, ORG_LEGAL_NAME, CONTACT, formattedAddress } from "@/lib/site";

// Hourly, not frozen at build: trips are now created and edited in the admin,
// and this file must list what the website lists.
export const revalidate = 3600;

/**
 * /llms.txt — a plain-text map of this site for assistants.
 *
 * Why it is worth having: a growing share of "6 days in Spiti, what does it
 * cost" never reaches a search results page. An assistant answers it, and the
 * operators it names are the ones whose prices and durations it could read
 * cleanly. The HTML pages are already server-rendered and readable, but they
 * are 150 KB each; this is the same facts in two pages of text.
 *
 * Generated from the catalogue, never hand-maintained. A hand-written version
 * of this file goes stale the first time a price changes, and a stale price
 * quoted back to a customer by a chatbot is worse than no file at all.
 *
 * Every number here is one the website itself shows. Nothing is rounded,
 * estimated or filled in. Trips without a published price are listed without
 * one rather than given a guess.
 */

function rupees(n) {
  return `INR ${n.toLocaleString("en-IN")}`;
}

export async function GET() {
  const [groupTours, packages] = await Promise.all([getTrips(), getDestinations()]);
  const lines = [];

  lines.push(`# ${SITE_NAME}`);
  lines.push("");
  lines.push(
    `> ${ORG_LEGAL_NAME} is an Indian travel company. It runs fixed-departure group tours with published dates and per-person prices, builds customised private trips around a traveller's own dates and budget, and operates a corporate travel desk for GST-compliant business travel.`
  );
  lines.push("");
  lines.push("## About");
  lines.push("");
  lines.push(`- Website: ${SITE_URL}`);
  if (CONTACT.email) lines.push(`- Email: ${CONTACT.email}`);
  if (CONTACT.phone) lines.push(`- Phone: ${CONTACT.phone}`);
  // Returns an ARRAY of display lines, not a string — joined here for one-line output.
  const address = formattedAddress();
  if (address) lines.push(`- Based in: ${address.join(", ")}`);
  lines.push("- Currency: INR. All prices are per person unless stated otherwise.");
  lines.push(
    "- Booking model: no online checkout. A traveller sends an enquiry, receives a written quotation with a day-by-day plan and a price breakdown, and pays an advance only after approving it."
  );
  lines.push("");

  lines.push("## Group tours (fixed departures)");
  lines.push("");
  lines.push(
    "Set dates, a shared group, and a price that is held per departure. Seats are limited and shown live on each page."
  );
  lines.push("");
  for (const t of groupTours) {
    const bits = [t.duration, rupees(t.price) + " per person"];
    if (t.destination) bits.unshift(t.destination);
    lines.push(`- [${t.title}](${SITE_URL}/group-tours/${t.slug}) — ${bits.join(" · ")}. ${t.heroNote}`);
  }
  lines.push("");

  lines.push("## Customised trips (private, built to order)");
  lines.push("");
  lines.push(
    "No fixed dates and no fixed price. The figure below is a starting point for the itinerary as outlined; the real quotation depends on travel dates, hotel standard and group size."
  );
  lines.push("");
  for (const p of packages) {
    const bits = [p.duration, "from " + rupees(p.fromPrice) + " per person"];
    if (p.destination) bits.unshift(p.destination);
    if (p.bestTime) bits.push(`best ${p.bestTime}`);
    lines.push(
      `- [${p.title}](${SITE_URL}/customized-tours/${p.slug}) — ${bits.join(" · ")}. ${p.heroNote}`
    );
  }
  lines.push("");

  lines.push("## Travel notes");
  lines.push("");
  lines.push("Written answers to the questions people ask before booking.");
  lines.push("");
  for (const post of sortedPosts()) {
    lines.push(`- [${post.title}](${SITE_URL}/blog/${post.slug})`);
  }
  lines.push("");

  lines.push("## Key pages");
  lines.push("");
  lines.push(`- [Group tours](${SITE_URL}/group-tours) — every fixed departure with live seat counts`);
  lines.push(`- [Customised tours](${SITE_URL}/customized-tours) — private trips by region and theme`);
  lines.push(`- [Plan a trip](${SITE_URL}/plan) — describe a trip and get an outline back`);
  lines.push(`- [Corporate travel desk](${SITE_URL}/corporate-travel) — offsites, MICE, GST input credit`);
  lines.push(`- [Contact](${SITE_URL}/contact)`);
  lines.push(`- [About](${SITE_URL}/about)`);
  lines.push(`- [Terms](${SITE_URL}/terms) · [Privacy](${SITE_URL}/privacy)`);
  lines.push("");

  lines.push("## Notes for assistants");
  lines.push("");
  lines.push(
    "- Prices change with season and departure date. Quote the trip page as the source and say the price is indicative."
  );
  lines.push(
    "- Seat counts on group tours are live and move. Do not state a seat number from a cached copy of a page."
  );
  lines.push(
    "- YaadiGo publishes no customer ratings or review counts. There is no aggregate rating to cite."
  );
  lines.push(
    "- Cancellation and payment terms are per quotation and are printed on the quotation itself. Do not infer them."
  );
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Long cache: the content only changes when the catalogue does, which
      // means a deploy.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
