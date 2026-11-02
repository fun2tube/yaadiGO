import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import Editable from "@/components/cms/editable";
import AskBar from "@/components/ask-bar";
import BuiltPage from "@/components/builder/render";
import CountUp from "@/components/count-up";
import CinematicHero from "@/components/motion/cinematic-hero";
import HorizontalGallery from "@/components/motion/horizontal-gallery";
import ProcessSteps from "@/components/motion/process-steps";
import TripIdeas from "@/components/motion/trip-ideas";
import PlaceBand from "@/components/motion/place-band";
import EditorialHeading from "@/components/motion/editorial-heading";
import SmoothScroll from "@/components/motion/smooth-scroll";
import CursorLabel from "@/components/motion/cursor-label";
import { ParallaxBackdrop } from "@/components/motion/interactive";
import { getPublishedLayout } from "@/lib/cms/pages";
import { getTrips, getDestinations } from "@/lib/cms/catalogue";
import { getImage } from "@/lib/media";
import { sortedPosts } from "@/lib/posts";
import { siteProof, PROOF_POINTS } from "@/lib/proof";
import { quickEnquiryHref, CORPORATE_URL, CONTACT } from "@/lib/site";
import { SparkleIcon, ArrowIcon, WhatsAppIcon, ChatIcon } from "@/components/icons";

/**
 * A page built in the admin wins over the one below it.
 *
 * The same rule the override store follows: **nothing published means exactly
 * the site that is in git.** So this file stays the real homepage — reviewable,
 * diffable, and what a new deployment serves — right up until somebody
 * deliberately builds and publishes a replacement, and it comes straight back
 * the moment they revert.
 *
 * `SiteNav` and `SiteFooter` stay outside the built content on purpose: a
 * visitor must never be able to reach a page with no way off it, whatever
 * somebody has or has not dragged onto the canvas.
 */
async function BuiltHome({ layout }) {
  // Live data, fetched once and handed to the blocks through Puck's metadata.
  // A block cannot fetch for itself, and baking trips into the saved layout
  // would freeze seat counts at whatever they were when somebody last pressed
  // Publish — the one number on this site that must never be stale.
  const [trips, { stats }] = await Promise.all([getTrips(), Promise.resolve(siteProof())]);

  return (
    <>
      <Reveal />
      <SiteNav />
      <main>
        <BuiltPage data={layout} metadata={{ trips, stats }} />
      </main>
      <SiteFooter />
    </>
  );
}

/** Resolve a media-library id to what the client motion components need. */
function photo(id) {
  const image = getImage(id);
  return image ? { id, src: image.src, alt: image.alt, title: image.title } : null;
}

// The plan behind this page is docs/design/homepage-content-strategy.md.
// In one line: the homepage is for leisure travellers, it names the two ways
// to travel with us, and corporate gets exactly one line near the bottom.

// Photography, by slot. Each id is in src/lib/media.js with alt text and
// credit. People in frame wherever possible — a trip, not a postcard.
const HERO_SLIDES = [
  "hero-himalaya-hikers",
  "hero-kerala-houseboat",
  "hero-amber-fort",
  "hero-ladakh-riders",
  "hero-andaman-beach",
];
const CLOSE_PHOTO = "close-ladakh-flags";

// Journal posts have no images of their own; each is shown with the trip
// photo it is about.
const POST_PHOTOS = {
  vietnam: "vietnam-north-to-south",
  spiti: "spiti-valley-circuit",
  kerala: "kerala-honeymoon-trail",
  andaman: "andaman-honeymoon-escape",
  ladakh: "ladakh-high-passes",
  kashmir: "kashmir-valley-escape",
};
// Corporate posts stay off the leisure homepage, whatever their date.
const CORPORATE_POST = /gst|offsite|corporate|company|companies|invoice/i;

// Occasions for the trip-ideas filter. `match` reads fields that already
// exist on every package, so new trips sort themselves.
const OCCASIONS = [
  { key: "honeymoon", label: "Honeymoon", match: (p) => p.idealFor.some((x) => /honeymoon|couple/i.test(x)) },
  { key: "family", label: "Family", match: (p) => p.idealFor.some((x) => /family|kids|parents/i.test(x)) },
  { key: "weekend", label: "Short breaks", match: (p) => p.idealFor.some((x) => /weekend/i.test(x)) || /^[2-5]/.test(p.duration) },
  { key: "pilgrimage", label: "Pilgrimage", match: (p) => /pilgrimage/i.test(p.theme) },
  { key: "wildlife", label: "Wildlife", match: (p) => /wildlife/i.test(p.theme) },
  { key: "abroad", label: "International", match: (p) => p.region === "International" },
];

const formatINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const placeName = (destination) => destination.split("·")[0].trim();

export default async function Home() {
  const layout = await getPublishedLayout("/");
  if (layout) return <BuiltHome layout={layout} />;

  const [groupTours, destinations] = await Promise.all([getTrips(), getDestinations()]);
  const whatsapp = quickEnquiryHref("Hi YaadiGo — I'd like help planning a trip.");
  const isWhatsApp = whatsapp.startsWith("http");
  const { stats } = siteProof();

  // ── Live numbers. Every figure on this page comes from the catalogue. ──
  // Only batches someone can book today: seats left, before the cut-off,
  // not closed or cancelled (lib/inventory.js decides; the catalogue applies it).
  const departures = groupTours
    .flatMap((tour) =>
      (tour.departures ?? [])
        .filter((d) => d.bookable)
        .map((d) => ({ tour, d }))
    )
    .sort((a, b) => a.d.start.localeCompare(b.d.start));
  const groupFrom = Math.min(...groupTours.map((x) => x.price));
  const customFrom = Math.min(...destinations.map((x) => x.fromPrice));

  const soonItems = departures
    .filter(({ tour }) => !tour.cardImageHidden && getImage(tour.cardImageId))
    .slice(0, 10)
    .map(({ tour, d }) => {
      const img = getImage(tour.cardImageId);
      const date = new Date(`${d.start}T00:00:00Z`);
      return {
        key: `${tour.slug}-${d.start}`,
        slug: tour.slug,
        href: `/group-tours/${tour.slug}`,
        title: tour.title,
        destination: tour.destination,
        duration: tour.duration,
        price: d.price,
        seats: d.seatsLeft,
        date: {
          day: date.getUTCDate(),
          month: date.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
        },
        src: img.src,
        alt: img.alt,
      };
    });

  const ideas = destinations
    .filter((p) => !p.cardImageHidden && getImage(p.cardImageId))
    .map((p) => {
      const img = getImage(p.cardImageId);
      return {
        slug: p.slug,
        href: `/customized-tours/${p.slug}`,
        title: p.title,
        destination: p.destination,
        duration: p.duration,
        price: p.fromPrice,
        idealFor: p.idealFor ?? [],
        occasions: OCCASIONS.filter((o) => o.match({ ...p, idealFor: p.idealFor ?? [] })).map((o) => o.key),
        src: img.src,
        alt: img.alt,
      };
    });
  const occasions = [
    { key: "all", label: "All ideas", count: ideas.length },
    ...OCCASIONS.map((o) => ({
      key: o.key,
      label: o.label,
      count: ideas.filter((i) => i.occasions.includes(o.key)).length,
    })).filter((o) => o.count > 0),
  ];

  const posts = sortedPosts()
    .filter((p) => !CORPORATE_POST.test(`${p.slug} ${p.title}`))
    .slice(0, 3)
    .map((p) => {
      const key = Object.keys(POST_PHOTOS).find((k) => p.slug.includes(k));
      return { ...p, image: photo(POST_PHOTOS[key] ?? "hero-himalaya-hikers") };
    });

  // The type band between the two products and the departures: every place
  // the catalogue sells, first name only, de-duplicated, group tours first.
  const places = [
    ...new Set([...groupTours, ...destinations].map((x) => placeName(x.destination ?? ""))),
  ]
    .filter(Boolean)
    .slice(0, 12);
  const groupPhoto = photo("way-group");
  const privatePhoto = photo("way-private");
  const closePhoto = photo(CLOSE_PHOTO);


  const ways = [
    {
      key: "group",
      numeral: "I",
      name: ["Group", "Tours"],
      line: "Join a small group on a fixed date.",
      image: groupPhoto,
      rows: [
        ["Dates", "Set departures — pick one"],
        ["You travel with", "A small group of fellow travellers"],
        ["Price", "One all-in price per person, published"],
        ["Best for", "Solo travellers, friends, first trips"],
      ],
      from: groupFrom,
      count: `${groupTours.length} tours · ${departures.length} departures`,
      cta: "See departures",
      href: "#departures",
    },
    {
      key: "custom",
      numeral: "II",
      name: ["Customized", "Tours"],
      line: "Your own trip, on your dates.",
      image: privatePhoto,
      rows: [
        ["Dates", "Whenever you want"],
        ["You travel with", "Only your people"],
        ["Price", "Quoted for your plan — free draft first"],
        ["Best for", "Families, couples, honeymoons, parents"],
      ],
      from: customFrom,
      count: `${destinations.length} trip ideas, or any place you name`,
      cta: "Start planning",
      href: "/customized-tours",
    },
  ];

  const heroStats = [
    { value: departures.length, suffix: "", label: "group departures open" },
    { value: groupTours.length + destinations.length, suffix: "", label: "trips across India & abroad" },
    stats[2],
  ];

  const [leadPost, ...morePosts] = posts;

  return (
    <>
      <SmoothScroll />
      <CursorLabel />
      <Reveal />
      <SiteNav />

      {/* overflow-x-clip: rails and bands sit wider than the screen until they
          move into place, which would otherwise widen the page on a phone.
          clip, not hidden — hidden would break the sticky sections below. */}
      <main className="overflow-x-clip">
        {/* 1 — Hero: what we do, and the fork ------------------------------- */}
        <CinematicHero slides={HERO_SLIDES.map(photo).filter(Boolean)}>
          <span
            className="animate-fade-up flex items-center gap-4 eyebrow text-white/75"
            style={{ "--fade-delay": "500ms" }}
          >
            <span aria-hidden="true" className="h-px w-10 bg-white/50" />
            <Editable id="home.hero.kicker" as="span">
              Group tours &amp; customized trips · India and abroad
            </Editable>
          </span>

          <EditorialHeading
            id="home.hero.title"
            as="h1"
            play="load"
            text="Travel together, *or travel your way.*"
            className="display-light mt-5 max-w-6xl text-[44px] leading-[0.98] text-white [text-wrap:balance] sm:mt-7 sm:text-[88px] lg:text-[118px]"
          />

          <div className="mt-6 grid gap-7 sm:mt-10 sm:gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="animate-fade-up max-w-md" style={{ "--fade-delay": "1100ms" }}>
              <Editable
                id="home.hero.lede"
                as="p"
                multiline
                className="text-[15px] leading-relaxed text-white/75 sm:text-[17px]"
              >
                Join a small-group departure on a fixed date, or let us design a private trip around
                your dates and budget. Either way, the whole itinerary is written down before you pay.
              </Editable>

              <dl className="mt-6 flex divide-x divide-white/15 sm:mt-8">
                {heroStats.map((s) => (
                  <div key={s.label} className="pr-6 [&:not(:first-child)]:pl-6">
                    <dt className="display-light text-[28px] leading-none text-white sm:text-[34px]">
                      <CountUp value={s.value} prefix={s.prefix ?? ""} suffix={s.suffix} />
                    </dt>
                    <dd className="mt-2 max-w-[130px] text-[11.5px] leading-snug text-white/55">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div
              className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center"
              style={{ "--fade-delay": "1250ms" }}
            >
              <a
                href="#departures"
                className="btn-roll inline-flex items-center justify-center gap-3 rounded-full bg-paper px-8 py-[18px] text-[14px] font-semibold text-ink transition-colors duration-500 hover:bg-white"
              >
                <RollLabel>See upcoming departures</RollLabel>
                <ArrowIcon size={16} />
              </a>
              <Link
                href="/customized-tours"
                className="btn-roll inline-flex items-center justify-center gap-3 rounded-full border border-white/35 px-8 py-[17px] text-[14px] font-semibold text-white backdrop-blur-sm transition-colors duration-500 hover:border-white hover:bg-white/10"
              >
                <RollLabel>Plan a customized trip</RollLabel>
              </Link>
              <a
                href={whatsapp}
                {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="link-editorial justify-center self-center text-[13.5px] font-medium text-white/75 transition-colors hover:text-white sm:ml-3"
              >
                {isWhatsApp ? <WhatsAppIcon size={15} /> : <ChatIcon size={15} />}
                {isWhatsApp ? "Talk to a planner" : "Quick enquiry"}
              </a>
            </div>
          </div>
        </CinematicHero>

        {/* 2 — Two ways to travel ------------------------------------------- */}
        <section className="bg-paper pb-28 pt-28 sm:pb-40 sm:pt-44">
          <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-10 lg:px-14">
            <div className="grid gap-6 xl:grid-cols-12">
              <div className="xl:col-span-3 xl:pt-5">
                <SectionMark n="01" className="text-accent-deep">
                  <Editable id="home.ways.eyebrow" as="span">Two ways to travel</Editable>
                </SectionMark>
              </div>
              <EditorialHeading
                id="home.ways.heading"
                text="Join a group, *or make it your own.*"
                className="display-light text-[44px] leading-[1] text-paper-text [text-wrap:balance] sm:text-[72px] lg:text-[96px] xl:col-span-9"
              />
            </div>

            <div className="mt-20 grid gap-24 lg:mt-28 lg:grid-cols-2 lg:gap-x-16">
              {ways.map((way, i) => {
                const Anchor = way.href.startsWith("#") ? "a" : Link;
                return (
                  <article key={way.key} className={i === 1 ? "lg:mt-48" : ""}>
                    {/* The photo repeats the link below it, so it is skipped by
                        keyboard and screen reader — one stop per choice. */}
                    <Anchor href={way.href} data-cursor="Explore" className="group block" tabIndex={-1} aria-hidden="true">
                      <div data-reveal="wipe" style={{ "--reveal-delay": `${i * 150}ms` }}>
                        <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-paper-dim">
                          <div className="absolute inset-0">
                            {way.image && (
                              <Image
                                src={way.image.src}
                                alt=""
                                fill
                                sizes="(max-width: 1024px) 100vw, 50vw"
                                className="object-cover transition-transform duration-[2000ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                              />
                            )}
                          </div>
                          <span className="display-italic absolute left-5 top-4 font-display text-[22px] text-white/90">
                            {way.numeral}
                          </span>
                        </div>
                      </div>
                    </Anchor>

                    <div data-reveal="soft" className="mt-9 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                      <h3 className="display-light text-[44px] leading-none text-paper-text sm:text-[58px]">
                        {way.name[0]} <em>{way.name[1]}</em>
                      </h3>
                      <span className="eyebrow text-paper-text-faint">{way.count}</span>
                    </div>
                    <p data-reveal="soft" className="mt-4 text-[17px] text-paper-text-muted">
                      {way.line}
                    </p>

                    <dl className="mt-8 grid grid-cols-1 gap-x-8 border-t border-paper-line sm:grid-cols-2">
                      {way.rows.map(([k, v]) => (
                        <div key={k} className="border-b border-paper-line py-4">
                          <dt className="eyebrow text-paper-text-faint">{k}</dt>
                          <dd className="mt-1.5 text-[15px] text-paper-text">{v}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
                      <span className="text-[13px] text-paper-text-muted">
                        from{" "}
                        <span className="display-light text-[34px] text-paper-text">{formatINR(way.from)}</span>
                        {" "}per person
                      </span>
                      <Anchor href={way.href} className="link-editorial text-[15px] font-semibold text-paper-text">
                        {way.cta}
                        <ArrowIcon />
                      </Anchor>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* An editorial pause: every place we go, in type ----------------- */}
        {places.length > 3 && <PlaceBand places={places} />}

        {/* 3 — Leaving soon: group departures, sideways ------------------- */}
        <div id="departures" className="scroll-mt-0">
          <HorizontalGallery
            items={soonItems}
            allHref="/group-tours"
            allLabel={`All ${groupTours.length} group tours`}
            intro={
              <>
                <SectionMark n="02" className="text-accent-bright">
                  <Editable id="home.soon.eyebrow" as="span">Group Tours</Editable>
                </SectionMark>
                <EditorialHeading
                  id="home.soon.heading"
                  text="Leaving *soon*"
                  className="display-light mt-6 text-[60px] leading-[0.95] text-ink-text sm:text-[96px] lg:text-[120px]"
                />
                <Editable
                  id="home.soon.body"
                  as="p"
                  multiline
                  className="mt-7 max-w-sm text-[15.5px] leading-relaxed text-ink-text-muted"
                >
                  Real dates, real seat counts, one price per person. Pick a departure and join
                  the group — keep scrolling to see what&apos;s next.
                </Editable>
              </>
            }
          />
        </div>

        {/* 4 — Customized trip ideas, by occasion ------------------------- */}
        <section className="bg-paper py-28 sm:py-44">
          <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-10 lg:px-14">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <SectionMark n="03" className="text-accent-deep">
                  <Editable id="home.ideas.eyebrow" as="span">Customized Tours</Editable>
                </SectionMark>
                <EditorialHeading
                  id="home.ideas.heading"
                  text="Trip ideas we'll build *around you*"
                  className="display-light mt-6 text-[44px] leading-[1] text-paper-text [text-wrap:balance] sm:text-[72px] lg:text-[88px]"
                />
              </div>
              <div data-reveal="soft" className="lg:col-span-4 lg:pb-3" style={{ "--reveal-delay": "200ms" }}>
                <Editable
                  id="home.ideas.body"
                  as="p"
                  multiline
                  className="max-w-sm text-[15.5px] leading-relaxed text-paper-text-muted"
                >
                  Starting points, not packages. Your dates, your pace, your hotels — and a free
                  draft before you decide.
                </Editable>
              </div>
            </div>

            <TripIdeas
              ideas={ideas}
              occasions={occasions}
              allHref="/customized-tours"
              allLabel={`See all ${destinations.length} trip ideas`}
            />
          </div>
        </section>

        {/* 5 — How a customized trip works, with the AI planner inside ----- */}
        <section className="relative bg-ink py-28 sm:py-44">
          <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-16 px-6 sm:px-10 lg:grid-cols-12 lg:gap-12 lg:px-14">
            {/* min-w-0: a grid item's default min width is its content, and the
                ask bar's input would otherwise push this column off a phone. */}
            <div className="min-w-0 lg:sticky lg:top-[16svh] lg:col-span-5 lg:self-start">
              <SectionMark n="04" className="text-accent-bright">
                <Editable id="home.how.eyebrow" as="span">How a customized trip works</Editable>
              </SectionMark>
              <EditorialHeading
                id="home.how.heading"
                text="From idea to itinerary, *before you pay a rupee.*"
                className="display-light mt-6 text-[40px] leading-[1.02] text-ink-text [text-wrap:balance] sm:text-[60px]"
              />

              <div
                data-reveal="soft"
                style={{ "--reveal-delay": "200ms" }}
                className="mt-12 border-t border-ink-line-strong pt-8"
              >
                <p className="flex items-center gap-2.5 text-[15px] font-semibold text-ink-text">
                  <SparkleIcon size={15} className="text-accent-bright" />
                  <Editable id="home.how.ask" as="span">Want a draft right now? Type a place.</Editable>
                </p>
                <p className="mt-1.5 text-[13.5px] text-ink-text-faint">
                  Our AI Trip Planner writes a day-by-day plan in about a minute. Free.
                </p>
                <div className="mt-5">
                  <AskBar />
                </div>
                <a
                  href={whatsapp}
                  {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="link-editorial mt-6 text-[13.5px] font-medium text-ink-text-muted transition-colors hover:text-ink-text"
                >
                  {isWhatsApp ? <WhatsAppIcon size={15} /> : <ChatIcon size={15} />}
                  Or message a planner — a person replies the same day.
                </a>
              </div>
            </div>

            <div className="min-w-0 lg:col-span-6 lg:col-start-7">
              <ProcessSteps
                steps={[
                  ["1", "Tell us where and when", "Dates, who's coming, a rough budget. Two minutes, by form, WhatsApp or the AI planner.", "2 minutes"],
                  ["2", "Get a free day-by-day draft", "Hotels, transfers and timings written out — not a brochure, an actual plan.", "Within hours"],
                  ["3", "Change anything", "Swap a hotel, add a day, cut a day. As many rounds as it takes.", "Free revisions"],
                  ["4", "Approve, then pay", "Nothing is payable until you say yes. Vouchers and on-trip support follow.", "₹0 until then"],
                ].map(([n, title, detail, note]) => ({
                  n,
                  note,
                  title: (
                    <Editable id={`home.how.step${n}.title`} as="h3">
                      {title}
                    </Editable>
                  ),
                  detail: (
                    <Editable id={`home.how.step${n}.detail`} as="p">
                      {detail}
                    </Editable>
                  ),
                }))}
              />
            </div>
          </div>
        </section>

        {/* 6 — Why YaadiGo ------------------------------------------------- */}
        <section className="bg-paper-dim py-28 sm:py-44">
          <div className="mx-auto grid w-full max-w-[1400px] gap-14 px-6 sm:px-10 lg:grid-cols-12 lg:gap-12 lg:px-14">
            <div className="lg:sticky lg:top-[18svh] lg:col-span-5 lg:self-start">
              <SectionMark n="05" className="text-accent-deep">
                <Editable id="home.why.eyebrow" as="span">Why YaadiGo</Editable>
              </SectionMark>
              <EditorialHeading
                id="home.why.heading"
                text="Four things you can *check before you trust us*"
                className="display-light mt-6 text-[40px] leading-[1.02] text-paper-text [text-wrap:balance] sm:text-[60px]"
              />
              <div data-reveal="soft" style={{ "--reveal-delay": "200ms" }}>
                <Editable
                  id="home.why.body"
                  as="p"
                  multiline
                  className="mt-7 max-w-md text-[15.5px] leading-relaxed text-paper-text-muted"
                >
                  We have no review count to wave at you yet. So here is what you can verify on this
                  site instead, in about thirty seconds.
                </Editable>
              </div>
            </div>

            <div className="grid border-l border-t border-paper-line-strong sm:grid-cols-2 lg:col-span-7">
              {PROOF_POINTS.map(({ id, title, detail }, i) => (
                <div
                  key={id}
                  data-reveal="soft"
                  style={{ "--reveal-delay": `${i * 110}ms` }}
                  className="group flex min-h-[260px] flex-col justify-between gap-10 border-b border-r border-paper-line-strong p-8 transition-colors duration-700 hover:bg-card sm:p-10"
                >
                  <span className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-paper-text-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span
                      aria-hidden="true"
                      className="h-px w-8 origin-right bg-accent-deep transition-transform duration-700 group-hover:scale-x-[2.5]"
                    />
                  </span>
                  <div>
                    {/* Keyed on the point's own id, not its position, so an
                        edit survives this list being reordered. */}
                    <Editable
                      id={`home.proof.${id}.title`}
                      as="h3"
                      className="font-display text-[24px] font-light leading-[1.15] tracking-[-0.015em] text-paper-text"
                    >
                      {title}
                    </Editable>
                    <Editable
                      id={`home.proof.${id}.detail`}
                      as="p"
                      multiline
                      className="mt-3 text-[14px] leading-relaxed text-paper-text-muted"
                    >
                      {detail}
                    </Editable>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7 — Travel guides ----------------------------------------------- */}
        {leadPost && (
          <section className="bg-paper py-28 sm:py-40">
            <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-10 lg:px-14">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <SectionMark n="06" className="text-accent-deep">
                    <Editable id="home.guides.eyebrow" as="span">From the journal</Editable>
                  </SectionMark>
                  <EditorialHeading
                    id="home.guides.heading"
                    text="Still deciding? *Read this first.*"
                    className="display-light mt-6 text-[40px] leading-[1.02] text-paper-text sm:text-[64px]"
                  />
                </div>
                <Link href="/blog" className="link-editorial text-[15px] font-semibold text-paper-text">
                  All guides <ArrowIcon />
                </Link>
              </div>

              <div className="mt-16 grid gap-14 lg:grid-cols-12 lg:gap-12">
                <Link href={`/blog/${leadPost.slug}`} data-cursor="Read" className="group block lg:col-span-7">
                  <div data-reveal="wipe">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-paper-dim">
                      <div className="absolute inset-0">
                        {leadPost.image && (
                          <Image
                            src={leadPost.image.src}
                            alt=""
                            fill
                            sizes="(max-width: 1024px) 100vw, 58vw"
                            className="object-cover transition-transform duration-[2000ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="mt-7 block eyebrow text-paper-text-faint">Guide · 01</span>
                  <h3 className="mt-3 max-w-2xl font-display text-[30px] font-light leading-[1.12] tracking-[-0.02em] text-paper-text transition-colors duration-500 group-hover:text-accent-deep sm:text-[40px]">
                    {leadPost.title}
                  </h3>
                  <p className="mt-3 line-clamp-2 max-w-xl text-[15px] leading-relaxed text-paper-text-muted">
                    {leadPost.excerpt}
                  </p>
                </Link>

                <div className="flex flex-col gap-12 lg:col-span-5">
                  {morePosts.map((post, i) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      data-cursor="Read"
                      className="group grid grid-cols-[2fr_3fr] gap-6 border-t border-paper-line pt-8 first:border-t-0 first:pt-0"
                    >
                      <div data-reveal="wipe" style={{ "--reveal-delay": `${(i + 1) * 140}ms` }}>
                        <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-paper-dim">
                          <div className="absolute inset-0">
                            {post.image && (
                              <Image
                                src={post.image.src}
                                alt=""
                                fill
                                sizes="(max-width: 1024px) 40vw, 18vw"
                                className="object-cover transition-transform duration-[2000ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="eyebrow text-paper-text-faint">Guide · {String(i + 2).padStart(2, "0")}</span>
                        <h3 className="mt-3 font-display text-[21px] font-light leading-[1.2] tracking-[-0.01em] text-paper-text transition-colors duration-500 group-hover:text-accent-deep sm:text-[24px]">
                          {post.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-paper-text-muted">
                          {post.excerpt}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 8 — Close: a person, plus the one corporate line ----------------- */}
        <ParallaxBackdrop src={closePhoto.src} alt={closePhoto.alt} veil="bg-ink/65">
          <div className="mx-auto w-full max-w-6xl px-6 pb-14 pt-36 text-center sm:px-10 sm:pt-56">
            <SectionMark n="07" className="justify-center text-white/70">
              <Editable id="home.close2.eyebrow" as="span">Talk to us</Editable>
            </SectionMark>
            <EditorialHeading
              id="home.close2.heading"
              text="Not sure yet? *Ask a person.*"
              className="display-light mx-auto mt-8 max-w-5xl text-[52px] leading-[0.98] text-white [text-wrap:balance] sm:text-[96px] lg:text-[124px]"
            />
            <div data-reveal="soft" style={{ "--reveal-delay": "300ms" }}>
              <Editable
                id="home.close2.body"
                as="p"
                multiline
                className="mx-auto mt-8 max-w-lg text-[16px] leading-relaxed text-white/90 sm:text-[17px]"
              >
                Tell us roughly where and when. A planner replies the same day in business hours —
                with options, not a sales pitch.
              </Editable>
            </div>

            <div
              data-reveal="soft"
              style={{ "--reveal-delay": "420ms" }}
              className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <a
                href={whatsapp}
                {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="btn-roll inline-flex items-center justify-center gap-3 rounded-full bg-paper px-8 py-[18px] text-[14px] font-semibold text-ink transition-colors duration-500 hover:bg-white"
              >
                {isWhatsApp ? <WhatsAppIcon size={17} className="text-good" /> : <ChatIcon size={17} />}
                <RollLabel>{isWhatsApp ? "WhatsApp a planner" : "Send a quick enquiry"}</RollLabel>
              </a>
              {CONTACT.phoneHref && (
                <a
                  href={`tel:${CONTACT.phoneHref}`}
                  className="btn-roll inline-flex items-center justify-center gap-3 rounded-full border border-white/35 px-8 py-[17px] text-[14px] font-semibold text-white backdrop-blur-sm transition-colors duration-500 hover:border-white hover:bg-white/10"
                >
                  <RollLabel>{`Call ${CONTACT.phone}`}</RollLabel>
                </a>
              )}
            </div>

            {/* The only corporate content on this page — by design. */}
            <p className="mt-28 border-t border-white/15 pt-6 text-[13.5px] text-white/55">
              Booking travel for your company?{" "}
              <a
                href={CORPORATE_URL}
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                Corporate Travel Desk →
              </a>
            </p>
          </div>
        </ParallaxBackdrop>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * The small numbered label above each section — "(01) — Two ways to travel".
 * Numbered like a contents list, the same signal the nav uses.
 */
function SectionMark({ n, children, className = "" }) {
  return (
    <span data-reveal="soft" className={`flex items-center gap-3 eyebrow ${className}`}>
      <span>({n})</span>
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-40" />
      {children}
    </span>
  );
}

/** A button label that rolls up on hover and is replaced from below. */
function RollLabel({ children }) {
  return (
    <span className="roll-mask">
      <span className="roll">
        {children}
        {/* The copy that rolls in — a real element rather than ::after
            content, so a screen reader never announces the label twice. */}
        <span aria-hidden="true" className="roll-copy">
          {children}
        </span>
      </span>
    </span>
  );
}
