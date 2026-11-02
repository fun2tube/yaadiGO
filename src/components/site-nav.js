import SiteNavClient from "./site-nav-client";
import { getTrips } from "@/lib/cms/catalogue";
import { getNavigation } from "@/lib/cms/navigation";

/**
 * Server wrapper around the navigation.
 *
 * Its only job is to fetch the MERGED catalogue and hand it down, so the
 * mega-menu shows what the admin published rather than what the code says.
 * Doing it here rather than in each page means a new page cannot forget, and
 * an unpublished trip cannot linger in the nav after it has gone from the
 * listing — which is exactly the bug this replaced.
 *
 * It now also resolves the MENU, which an admin can reorder and rename. An
 * unsaved menu returns the coded default, so this is a no-op until somebody
 * edits it.
 */
export default async function SiteNav() {
  const [trips, nav] = await Promise.all([getTrips(), getNavigation()]);
  return <SiteNavClient trips={trips} links={nav.links} mobileLinks={nav.mobileLinks} />;
}
