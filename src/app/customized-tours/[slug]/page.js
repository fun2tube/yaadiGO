import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import ScrollProgress from "@/components/scroll-progress";
import JsonLd from "@/components/json-ld";
import PackageEnquiry from "@/components/package-enquiry";
import PackageCard from "@/components/package-card";
import Img from "@/components/img";
import EditableImg from "@/components/cms/editable-img";
import { getImage } from "@/lib/media";
import { packages } from "@/lib/packages";
import { redirectFor } from "@/lib/cms/trips";
import { getDestination, getDestinations } from "@/lib/cms/catalogue";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import {
  CheckIcon,
  AlertIcon,
  ChevronIcon,
  CalendarIcon,
  MapIcon,
  UsersIcon,
} from "@/components/icons";

export function generateStaticParams() {
  return packages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  // The merged catalogue, so a trip created or renamed in the admin gets the
  // right title — not just the 20 that started in code.
  const pkg = await getDestination(slug);
  if (!pkg) return {};

  const description = `${pkg.heroNote} ${pkg.duration}, from ₹${pkg.fromPrice.toLocaleString(
    "en-IN"
  )} per person. Customised to your dates — free itinerary, no payment until you approve it.`;

  return {
    title: `${pkg.title} — Customised ${pkg.destination} Trip`,
    description: description.slice(0, 158),
    alternates: { canonical: `/customized-tours/${pkg.slug}` },
    // No `images` key here on purpose. Defining `openGraph` replaces the
    // parent's images entirely, which is why this page used to point at the
    // generic site card by hand. `opengraph-image.js` in this same folder now
    // does better — Next gives the colocated image precedence, and it carries
    // this package's own name, length and from-price.
    openGraph: {
      type: "website",
      title: pkg.title,
      description,
    },
  };
}

export default async function PackagePage({ params }) {
  const { slug } = await params;
  const pkg = await getDestination(slug);
  if (!pkg) {
    // An archived trip forwards its old URL rather than 404ing — it may have
    // links, bookmarks and search rankings behind it.
    const target = await redirectFor(slug);
    if (target) permanentRedirect(target);
    notFound();
  }

  const related = (await getDestinations())
    .filter((p) => p.slug !== pkg.slug && (p.region === pkg.region || p.theme === pkg.theme))
    .slice(0, 3);

  // A customised package is as much a TouristTrip as a fixed departure is.
  // These pages were emitting only a breadcrumb and an FAQ, so thirteen trips
  // were structurally invisible as trips — the divergence from
  // /group-tours/[slug] looked accidental rather than intended.
  //
  // The price is modelled as a MINIMUM, not a price. The page says "from
  // ₹24,500" because the real figure depends on dates and hotel band, and
  // `price` would assert a number nobody has agreed to. `priceSpecification`
  // with `minPrice` says the same thing the page says.
  //
  // No `availability`: a customised trip has no seat inventory, so there is
  // nothing truthful to put there. Fixed departures have seats and say so.
  const tripSchema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: pkg.title,
    description: pkg.heroNote,
    url: `${SITE_URL}/customized-tours/${pkg.slug}`,
    ...(pkg.theme ? { touristType: pkg.theme } : {}),
    itinerary: pkg.outline.map((day) => ({
      "@type": "TouristAttraction",
      name: day.title,
      description: day.detail,
    })),
    offers: {
      "@type": "Offer",
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: pkg.fromPrice,
        priceCurrency: "INR",
      },
    },
    provider: { "@type": "TravelAgency", name: SITE_NAME, url: SITE_URL },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Customized Tours", item: `${SITE_URL}/customized-tours` },
      { "@type": "ListItem", position: 2, name: pkg.title, item: `${SITE_URL}/customized-tours/${pkg.slug}` },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pkg.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <JsonLd data={tripSchema} />
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqSchema} />
      <ScrollProgress />
      <Reveal />
      <SiteNav />

      <main className="pt-[84px]">
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink">
          {getImage(pkg.coverImageId || pkg.slug) && (
            <>
              {/* Swappable from the page editor. The cmsId is keyed to the
                  destination slug, so the override survives any change to this
                  page's markup — and each destination gets its own. */}
              <EditableImg
                id={pkg.coverImageId || pkg.slug}
                cmsId={`destination.${pkg.slug}.hero`}
                fill
                priority
                sizes="100vw"
                className="object-cover opacity-45"
              />
              {/* Keeps the headline readable regardless of what the photo
                  happens to be doing behind it. */}
              <div aria-hidden="true" className="absolute inset-0 bg-ink/55" />
            </>
          )}
          <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-[11px] text-ink-text-faint">
              <Link href="/customized-tours" className="hover:text-ink-text">
                Customized Tours
              </Link>
              <ChevronIcon size={10} />
              <span className="text-ink-text-muted">{pkg.region}</span>
            </nav>

            <span className="eyebrow mt-5 block text-accent-bright">{pkg.destination}</span>
            <h1 className="mt-2 max-w-3xl font-display text-[32px] font-bold leading-[1.08] tracking-tight text-ink-text sm:text-[46px]">
              {pkg.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-text-muted">
              {pkg.heroNote}
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink-line pt-6 sm:grid-cols-4">
              {[
                { Icon: CalendarIcon, label: "Suggested length", value: pkg.duration },
                { Icon: MapIcon, label: "Best time", value: pkg.bestTime },
                { Icon: UsersIcon, label: "Good for", value: pkg.idealFor.join(", ") },
                {
                  Icon: null,
                  label: "Indicative, per person",
                  value: `from ₹${pkg.fromPrice.toLocaleString("en-IN")}`,
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-text-faint">
                    {item.Icon && <item.Icon size={11} />} {item.label}
                  </dt>
                  <dd className="mt-1.5 text-[14px] font-semibold leading-snug text-ink-text">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10 lg:flex-row lg:gap-12">
          <div className="min-w-0 flex-1">
            {/* Highlights */}
            <section data-reveal>
              <h2 className="font-display text-[24px] font-bold text-paper-text">
                What this trip is built around
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {pkg.highlights.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14.5px] leading-relaxed text-paper-text-muted">
                    <span className="mt-0.5 shrink-0 text-accent-deep">
                      <CheckIcon size={14} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Suggested outline */}
            <section data-reveal className="mt-10">
              <h2 className="font-display text-[24px] font-bold text-paper-text">
                A suggested shape
              </h2>
              <p className="mt-1.5 text-[13.5px] text-paper-text-muted">
                A starting point, not a fixed plan. Every day here can move, stretch or go.
              </p>
              <ol className="mt-5 flex flex-col">
                {pkg.outline.map((block, i) => (
                  <li key={block.day} className="relative flex gap-5 pb-6 last:pb-0">
                    {i < pkg.outline.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[21px] top-11 h-[calc(100%-2.75rem)] w-px bg-paper-line-strong"
                      />
                    )}
                    <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-paper-line-strong bg-card font-mono text-[12px] font-semibold text-accent-deep">
                      {block.day}
                    </span>
                    <div className="pt-1.5">
                      <h3 className="text-[15.5px] font-bold text-paper-text">{block.title}</h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-paper-text-muted">
                        {block.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Everything covered */}
            <section data-reveal className="mt-10">
              <h2 className="font-display text-[24px] font-bold text-paper-text">
                Everything we can cover here
              </h2>
              <p className="mt-1.5 text-[13.5px] text-paper-text-muted">
                The full set for this destination. Your version won&apos;t include all of it —
                tell us which matter and we&apos;ll build around those.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {pkg.places.map((place) => (
                  <span
                    key={place}
                    className="rounded-lg border border-paper-line bg-card px-3 py-1.5 text-[13px] text-paper-text-muted"
                  >
                    {place}
                  </span>
                ))}
              </div>
            </section>

            {/* Inclusions / exclusions */}
            <section data-reveal className="mt-10 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="eyebrow text-good">Typically included</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {pkg.inclusions.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed text-paper-text-muted">
                      <span className="mt-0.5 shrink-0 text-good">
                        <CheckIcon size={13} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="eyebrow text-paper-text-faint">Not included</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {pkg.exclusions.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed text-paper-text-muted">
                      <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-paper-text-faint" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Know before you go */}
            <section data-reveal className="mt-10 rounded-2xl border border-warn/30 bg-warn/5 p-6">
              <h2 className="flex items-center gap-2 font-display text-[19px] font-bold text-paper-text">
                <span className="text-warn">
                  <AlertIcon size={17} />
                </span>
                Worth knowing before you commit
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {pkg.knowBefore.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed text-paper-text-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* FAQ */}
            <section data-reveal className="mt-10">
              <h2 className="font-display text-[24px] font-bold text-paper-text">
                Common questions
              </h2>
              <div className="mt-4 flex flex-col divide-y divide-paper-line">
                {pkg.faq.map((item) => (
                  <details key={item.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-paper-text">
                      {item.q}
                      <ChevronIcon
                        size={14}
                        className="shrink-0 text-paper-text-faint transition-transform group-open:rotate-90"
                      />
                    </summary>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-paper-text-muted">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          {/* Enquiry rail — no booking, no seats, no advance. */}
          <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[380px] lg:self-start">
            <PackageEnquiry pkg={pkg} />
          </aside>
        </div>

        {related.length > 0 && (
          <section className="border-t border-paper-line bg-paper-dim">
            <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
              <h2 className="font-display text-[22px] font-bold text-paper-text">
                Others people compare this with
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                {related.map((p, i) => (
                  <PackageCard key={p.slug} pkg={p} index={i} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
