import SiteNav from "@/components/site-nav";
import Editable from "@/components/cms/editable";
import Reveal from "@/components/reveal";
import { ParallaxBackdrop } from "@/components/motion/interactive";
import { getImage } from "@/lib/media";
import SiteFooter from "@/components/site-footer";
import TripBuilderForm from "@/components/trip-builder-form";
import PackageListing from "@/components/package-listing";
import { getDestinations } from "@/lib/cms/catalogue";
import JsonLd from "@/components/json-ld";
import { SITE_URL } from "@/lib/site";
import { ChevronIcon } from "@/components/icons";

export const metadata = {
  title: "Customized Tours — Built Around Your Dates & Budget",
  description:
    "Tell us your destination, dates and budget — get a free draft itinerary back within hours, refined with you before you pay anything.",
  alternates: { canonical: "/customized-tours" },
};

const STEPS = [
  { n: "1", title: "Tell us your trip", detail: "Destination, dates, group size, budget band — five fields, two minutes." },
  { n: "2", title: "We design it — free", detail: "A draft itinerary comes back within hours, built by someone who's actually planned that route before." },
  { n: "3", title: "Refine together", detail: "Swap a hotel, add a day in one city, cut a day in another — as many rounds as it takes." },
  { n: "4", title: "Book", detail: "Confirm once you're happy. We handle bookings, vouchers and on-trip support from there." },
];

const SAMPLES = [
  { title: "10-day Vietnam, north to south", tag: "Culture & heritage", detail: "Hanoi, Ha Long Bay overnight cruise, Hoi An, Ho Chi Minh City." },
  { title: "7-day Bali, slow pace", tag: "Relaxation", detail: "Ubud rice terraces, two beach nights in Uluwatu, private driver throughout." },
  { title: "5-day Rajasthan heritage circuit", tag: "Culture & heritage", detail: "Jaipur, Jodhpur, Udaipur — heritage-property stays, no more than 4 hours' drive between cities." },
];

const FAQ = [
  { q: "Is the first itinerary really free?", a: "Yes. You see the full draft — day plan, hotel options, indicative pricing — before any payment changes hands." },
  { q: "How long does the first draft take?", a: "Typically within a few hours during business hours; complex multi-country trips can take a day." },
  { q: "What if I want to change something after booking?", a: "Date and hotel changes are possible depending on the vendor's own cancellation window — we'll tell you the exact terms before you confirm." },
];

export default async function CustomizedToursPage() {
  const destinations = await getDestinations();

  // Same idea as the group-tours listing, with one difference that matters:
  // these carry `minPrice`, not `price`. The cards say "from", because the
  // real figure depends on dates and hotel band — so the schema says "from"
  // too rather than asserting a number nobody has agreed to.
  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "YaadiGo customized trips",
    numberOfItems: destinations.length,
    itemListElement: destinations.map((pkg, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "TouristTrip",
        name: pkg.title,
        url: `${SITE_URL}/customized-tours/${pkg.slug}`,
        ...(pkg.heroNote ? { description: pkg.heroNote } : {}),
        offers: {
          "@type": "Offer",
          priceSpecification: {
            "@type": "PriceSpecification",
            minPrice: pkg.fromPrice,
            priceCurrency: "INR",
          },
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
        <ParallaxBackdrop
          src={getImage("bali-slow-islands").src}
          alt={getImage("bali-slow-islands").alt}
          veil="bg-ink/55"
          preload
        >
          <div className="mx-auto flex min-h-[62svh] max-w-6xl flex-col justify-end px-6 pb-14 pt-36 sm:px-10 sm:pb-20">
            <span className="animate-fade-up">
              <Editable id="custom.eyebrow" as="span" className="eyebrow text-accent-bright">
                Customized Tours
              </Editable>
            </span>
            <div className="animate-fade-up" style={{ "--fade-delay": "120ms" }}>
              <Editable id="custom.heading" as="h1" className="mt-3 max-w-3xl font-display text-[36px] font-black leading-[1.04] tracking-tight text-white sm:text-[60px]">
                Tell us your dates and budget. We&apos;ll design the trip around them.
              </Editable>
            </div>
            <div className="animate-fade-up" style={{ "--fade-delay": "260ms" }}>
              <Editable id="custom.no-fixed-package-to-fit" as="p" multiline className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/75">
                No fixed package to fit yourself into — a plan built around
                what you actually want, and you see it before you pay for it.
              </Editable>
            </div>
          </div>
        </ParallaxBackdrop>

        <section className="mx-auto max-w-6xl px-6 py-14 sm:px-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="rounded-xl border border-paper-line bg-card p-5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 font-display text-[13px] font-semibold text-accent-deep">
                  {step.n}
                </span>
                <h3 className="mt-3 text-[14.5px] font-semibold text-paper-text">{step.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-paper-text-muted">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <PackageListing destinations={destinations} />

        <section className="bg-paper-dim">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10">
            <Editable id="custom.a-few-trips-we" as="h2" className="font-display text-[24px] font-medium text-paper-text">
              A few trips we&apos;ve built recently
            </Editable>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {SAMPLES.map((s) => (
                <div key={s.title} className="rounded-xl border border-paper-line bg-card p-5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-deep">
                    {s.tag}
                  </span>
                  <h3 className="mt-1.5 text-[15px] font-semibold text-paper-text">{s.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-paper-text-muted">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <Editable id="custom.common-questions" as="h2" className="font-display text-[24px] font-medium text-paper-text">
              Common questions
            </Editable>
              <div className="mt-5 flex flex-col divide-y divide-paper-line">
                {FAQ.map((item) => (
                  <details key={item.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-[14.5px] font-medium text-paper-text">
                      {item.q}
                      <ChevronIcon size={14} className="text-paper-text-faint transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-paper-text-muted">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <TripBuilderForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
