import { notFound, permanentRedirect } from "next/navigation";
import { groupTours } from "@/lib/tours";
import { redirectFor } from "@/lib/cms/trips";
import { getTrip, getTrips } from "@/lib/cms/catalogue";
import SiteNav from "@/components/site-nav";
import Reveal from "@/components/reveal";
import ScrollProgress from "@/components/scroll-progress";
import SocialVideo from "@/components/social-video";
import SiteFooter from "@/components/site-footer";
import TourDetail from "@/components/tour-detail";
import JsonLd from "@/components/json-ld";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return groupTours.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  // The merged catalogue, so admin-created and renamed trips get their own
  // title and price here, not just the trips that started in code.
  const tour = await getTrip(slug);
  if (!tour) return {};
  const description = `${tour.heroNote} Fixed departure ${tour.nextDeparture}, starting at ₹${tour.price.toLocaleString("en-IN")} per person.`;
  return {
    title: `${tour.title} — ${tour.duration}`,
    description,
    alternates: { canonical: `/group-tours/${tour.slug}` },
    openGraph: { type: "website", title: tour.title, description },
  };
}

export default async function TourDetailPage({ params }) {
  const { slug } = await params;
  // Unpublished trips 404 rather than rendering — a page nobody can reach
  // from a listing is still a page someone has the link to.
  const tour = await getTrip(slug);
  if (!tour) {
    // An archived trip forwards its old URL rather than 404ing.
    const target = await redirectFor(slug);
    if (target) permanentRedirect(target);
    notFound();
  }

  const related = (await getTrips()).filter((t) => t.slug !== tour.slug).slice(0, 3);

  const tripSchema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: tour.title,
    description: tour.heroNote,
    touristType: tour.theme,
    itinerary: tour.itinerary.map((day) => ({
      "@type": "TouristAttraction",
      name: day.title,
      description: day.detail,
    })),
    offers: {
      "@type": "Offer",
      price: tour.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
  };

  // The FAQ is rendered on this page under "Questions people ask before
  // booking" but was never marked up, so the one block of content most likely
  // to be lifted into a search result or an assistant answer was invisible to
  // both. /customized-tours/[slug] and the blog template already did this —
  // the trip template was the odd one out.
  //
  // Built from `tour.faq`, the same array the page renders, so the schema
  // cannot drift from what the visitor actually reads.
  const faqSchema = tour.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: tour.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }
    : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Group Tours", item: `${SITE_URL}/group-tours` },
      { "@type": "ListItem", position: 2, name: tour.title, item: `${SITE_URL}/group-tours/${tour.slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={tripSchema} />
      <JsonLd data={breadcrumbSchema} />
      {faqSchema ? <JsonLd data={faqSchema} /> : null}
      <ScrollProgress />
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <TourDetail tour={tour} related={related} />
      </main>
      <SocialVideo tripSlug={tour.slug} heading="On this trip" />
      <SiteFooter />
    </>
  );
}
