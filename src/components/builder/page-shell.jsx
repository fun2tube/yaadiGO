import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import BuiltPage from "./render";
import { getPublishedLayout } from "@/lib/cms/pages";
import { getTrips } from "@/lib/cms/catalogue";
import { siteProof } from "@/lib/proof";

/**
 * Render a built page, or hand back null so the coded one runs.
 *
 * Written once rather than repeated per route: four pages each re-deriving
 * "has this been built, and what live data do its blocks need" is four places
 * for the answer to drift. A new buildable page is now two lines at the top of
 * its own file.
 *
 * `SiteNav` and `SiteFooter` are added HERE, outside the built content, for the
 * same reason as on the homepage: a visitor must never reach a page with no way
 * off it, whatever has or has not been dragged onto the canvas.
 *
 * Usage, at the top of a page component:
 *
 *   const built = await buildFor("/about");
 *   if (built) return built;
 */
export async function buildFor(path) {
  const layout = await getPublishedLayout(path);
  if (!layout) return null;

  // Fetched once per render and passed down through Puck's metadata. Blocks
  // cannot fetch, and baking this into the saved layout would freeze seat
  // counts at whatever they were when somebody last pressed Publish.
  const [trips, proof] = await Promise.all([getTrips(), Promise.resolve(siteProof())]);

  return (
    <>
      <Reveal />
      <SiteNav />
      <main>
        <BuiltPage data={layout} metadata={{ trips, stats: proof.stats }} />
      </main>
      <SiteFooter />
    </>
  );
}
