import { getTrips } from "@/lib/cms/catalogue";
import { posts } from "@/lib/posts";
import { getDestinations } from "@/lib/cms/catalogue";
import { SITE_URL } from "@/lib/site";

// Rendered per request: an unpublished trip must disappear from the sitemap the
// moment staff hide it, and a build-time sitemap cannot know about CMS edits.
export const dynamic = "force-dynamic";

export default async function sitemap() {
  // Unpublished trips and destinations must not be advertised to crawlers.
  const groupTours = await getTrips();
  const packages = await getDestinations();

  const now = new Date();

  const staticRoutes = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/group-tours`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/plan`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/customized-tours`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/corporate-travel`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/corporate`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/credits`, changeFrequency: "monthly", priority: 0.2 },
  ].map((entry) => ({ ...entry, lastModified: now }));

  const tourRoutes = groupTours.map((tour) => ({
    url: `${SITE_URL}/group-tours/${tour.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const packageRoutes = packages.map((pkg) => ({
    url: `${SITE_URL}/customized-tours/${pkg.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const postRoutes = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...tourRoutes, ...packageRoutes, ...postRoutes];
}
