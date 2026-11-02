import SiteNav from "@/components/site-nav";
import Editable from "@/components/cms/editable";
import Reveal from "@/components/reveal";
import { ParallaxBackdrop } from "@/components/motion/interactive";
import { getImage } from "@/lib/media";
import SiteFooter from "@/components/site-footer";
import GroupToursListing from "@/components/group-tours-listing";
import { getTrips } from "@/lib/cms/catalogue";
import JsonLd from "@/components/json-ld";
import { SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Group Tours — Fixed Departure Packages",
  description:
    "Browse YaadiGo fixed-departure group tours by destination, duration and theme. Small groups, set dates, and what is included written out in full.",
  alternates: { canonical: "/group-tours" },
};

export default async function GroupToursPage() {
  // Merged with admin overrides, so an unpublished trip or an edited seat
  // count is reflected here rather than only in the admin.
  const trips = await getTrips();

  // Declares what this page lists, in the order it lists them. Without it a
  // crawler sees a grid of links and has to infer that they are trips; with it
  // the page states that it is a ranked list of fourteen TouristTrips and
  // carries each one's price.
  //
  // Built from `trips`, the same merged catalogue the grid renders, so an
  // unpublished trip is absent from both. Every price here is the one printed
  // on the card next to it.
  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "YaadiGo group tours",
    numberOfItems: trips.length,
    itemListElement: trips.map((trip, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "TouristTrip",
        name: trip.title,
        url: `${SITE_URL}/group-tours/${trip.slug}`,
        ...(trip.heroNote ? { description: trip.heroNote } : {}),
        offers: {
          "@type": "Offer",
          price: trip.price,
          priceCurrency: "INR",
        },
      },
    })),
  };

  return (
    <>
      <JsonLd data={listSchema} />
      <Reveal />
      <SiteNav />
      <main>
        {/* Photographic header: the place behind the promise. The photo
            drifts against the page as it scrolls away. */}
        <ParallaxBackdrop
          src={getImage("spiti-valley-circuit").src}
          alt={getImage("spiti-valley-circuit").alt}
          veil="bg-ink/60"
          preload
        >
          <div className="mx-auto flex min-h-[62svh] max-w-6xl flex-col justify-end px-6 pb-14 pt-36 sm:px-10 sm:pb-20">
            <span className="animate-fade-up">
              <Editable id="tours.eyebrow" as="span" className="eyebrow text-accent-bright">
                Group Tours
              </Editable>
            </span>
            <div className="animate-fade-up" style={{ "--fade-delay": "120ms" }}>
              <Editable id="tours.heading" as="h1" className="mt-3 max-w-3xl font-display text-[36px] font-black leading-[1.04] tracking-tight text-white sm:text-[60px]">
                Fixed departures, small groups, dates you can actually plan around.
              </Editable>
            </div>
            <div className="animate-fade-up" style={{ "--fade-delay": "260ms" }}>
              <Editable id="tours.every-tour-below-runs-on" as="p" multiline className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/75">
                Every tour below runs on set dates with a capped group size —
                what you see in the itinerary is what you get, inclusions and
                exclusions spelled out before you pay anything.
              </Editable>
            </div>
          </div>
        </ParallaxBackdrop>
        <GroupToursListing tours={trips} />
      </main>
      <SiteFooter />
    </>
  );
}
