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
import StackCards from "@/components/motion/stack-cards";
import TripIdeas from "@/components/motion/trip-ideas";
import SplitHeading from "@/components/motion/split-heading";
import { Magnetic, ParallaxBackdrop } from "@/components/motion/interactive";
import { getPublishedLayout } from "@/lib/cms/pages";
import { getTrips, getDestinations } from "@/lib/cms/catalogue";
import { getImage } from "@/lib/media";
import { sortedPosts } from "@/lib/posts";
import { siteProof, PROOF_POINTS } from "@/lib/proof";
import { getOverrides } from "@/lib/cms/store";
import { quickEnquiryHref, CORPORATE_URL, CONTACT } from "@/lib/site";
import {
  SparkleIcon,
  ChevronIcon,
  CalendarIcon,
  MapIcon,
  UsersIcon,
  WalletIcon,
  ShieldIcon,
  WhatsAppIcon,
  ChatIcon,
} from "@/components/icons";

// Why "Why YaadiGo" is now four checkable claims rather than four benefits:
// both competitors lead with social proof we do not have — 9,070 reviews,
// 1,500 verified agents — and the honest answer is not to invent a weaker
// version of it. Every line below can be verified by the visitor on this site,
// today, in about thirty seconds. Text lives in `lib/proof.js`; the icons are
// matched here because that module stays server/browser agnostic.
const PROOF_ICONS = [UsersIcon, MapIcon, WalletIcon, ShieldIcon];

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

  const [groupTours, destinations, overrides] = await Promise.all([
    getTrips(),
    getDestinations(),
    getOverrides(),
  ]);
  const t = (id, fallback) => overrides.text[id] ?? fallback;
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

  const heroTitle = t("home.hero.title", "Travel together, or travel your way.");
  const groupPhoto = photo("way-group");
  const privatePhoto = photo("way-private");
  const closePhoto = photo(CLOSE_PHOTO);

  return (
    <>
      <Reveal />
      <SiteNav />

      {/* overflow-x-clip: cards that slide in from the right sit off-screen
          until revealed, which would otherwise widen the page on a phone.
          clip, not hidden — hidden would break the sticky sections below. */}
      <main className="overflow-x-clip">
        {/* 1 — Hero: what we do, and the fork ------------------------------- */}
        <CinematicHero slides={HERO_SLIDES.map(photo).filter(Boolean)}>
          <span className="animate-fade-up inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 eyebrow text-white/85 backdrop-blur-md">
            <MapIcon size={12} />{" "}
            <Editable id="home.hero.kicker" as="span">
              Group tours &amp; customized trips · India and abroad
            </Editable>
          </span>

          <SplitHeading
            text={heroTitle}
            cmsId="home.hero.title"
            className="mt-6 max-w-4xl font-display text-[42px] font-black leading-[1.02] tracking-tight text-white [text-wrap:balance] sm:text-[66px] lg:text-[80px]"
          />

          <div className="animate-fade-up max-w-xl" style={{ "--fade-delay": "550ms" }}>
            <Editable
              id="home.hero.lede"
              as="p"
              multiline
              className="mt-5 text-[16px] leading-relaxed text-white/80 sm:text-[18px]"
            >
              Join a small-group departure on a fixed date, or let us design a private trip around
              your dates and budget. Either way, the whole itinerary is written down before you pay.
            </Editable>
          </div>

          <div
            className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ "--fade-delay": "700ms" }}
          >
            <Magnetic>
              <a
                href="#departures"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-7 py-4 text-[15px] font-bold text-white shadow-xl shadow-accent/30 transition-colors hover:bg-accent-bright"
              >
                <CalendarIcon size={16} /> See upcoming departures
              </a>
            </Magnetic>
            <Magnetic>
              <Link
                href="/customized-tours"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-bold text-ink transition-colors hover:bg-paper"
              >
                Plan a customized trip <ChevronIcon size={15} />
              </Link>
            </Magnetic>
            <a
              href={whatsapp}
              {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex items-center justify-center gap-2 px-3 py-3 text-[14px] font-semibold text-white/80 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              {isWhatsApp ? <WhatsAppIcon size={16} /> : <ChatIcon size={16} />}
              {isWhatsApp ? "Talk to a planner" : "Quick enquiry"}
            </a>
          </div>

          <dl
            className="animate-fade-up mt-10 flex flex-wrap gap-x-10 gap-y-4"
            style={{ "--fade-delay": "850ms" }}
          >
            {[
              { value: departures.length, suffix: "", label: "group departures open" },
              { value: groupTours.length + destinations.length, suffix: "", label: "trips across India & abroad" },
              stats[2],
            ].map((s) => (
              <div key={s.label}>
                <dt className="font-display text-[28px] font-black text-white">
                  <CountUp value={s.value} prefix={s.prefix ?? ""} suffix={s.suffix} />
                </dt>
                <dd className="mt-0.5 max-w-[170px] text-[12px] leading-snug text-white/65">{s.label}</dd>
              </div>
            ))}
          </dl>
        </CinematicHero>

        {/* 2 — Two ways to travel ------------------------------------------- */}
        <section className="bg-paper py-24 sm:py-32">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-10">
            <div className="max-w-2xl">
              <span data-reveal className="eyebrow text-accent-deep">
                <Editable id="home.ways.eyebrow" as="span">Two ways to travel</Editable>
              </span>
              <div data-reveal="clip" style={{ "--reveal-delay": "80ms" }}>
                <Editable
                  id="home.ways.heading"
                  as="h2"
                  className="mt-3 font-display text-[36px] font-black leading-[1.03] tracking-tight text-paper-text sm:text-[54px]"
                >
                  Join a group, or make it your own.
                </Editable>
              </div>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {[
                {
                  key: "group",
                  reveal: "left",
                  name: "Group Tours",
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
                  dark: true,
                },
                {
                  key: "custom",
                  reveal: "right",
                  name: "Customized Tours",
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
                  dark: false,
                },
              ].map((way, i) => (
                <article
                  key={way.key}
                  data-reveal={way.reveal}
                  style={{ "--reveal-delay": `${i * 120}ms` }}
                  className={`group flex flex-col overflow-hidden rounded-[32px] border ${
                    way.dark ? "border-ink bg-ink text-ink-text" : "border-paper-line bg-card text-paper-text"
                  }`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    {way.image && (
                      <Image
                        src={way.image.src}
                        alt={way.image.alt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                      />
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-ink/70"
                      style={{ maskImage: "linear-gradient(to top, #000 5%, transparent 55%)" }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                      <h3 className="font-display text-[32px] font-black leading-none text-white sm:text-[40px]">
                        {way.name}
                      </h3>
                      <p className="mt-2 text-[15.5px] font-semibold text-white/85">{way.line}</p>
                    </div>
                  </div>

                  <dl className="grid flex-1 grid-cols-1 gap-x-6 px-6 pt-4 sm:grid-cols-2 sm:px-8">
                    {way.rows.map(([k, v]) => (
                      <div
                        key={k}
                        className={`border-b py-3.5 ${way.dark ? "border-ink-line" : "border-paper-line"}`}
                      >
                        <dt className={`eyebrow ${way.dark ? "text-ink-text-faint" : "text-paper-text-faint"}`}>{k}</dt>
                        <dd className="mt-1 text-[14.5px] font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
                    <div>
                      <span className={`text-[13px] ${way.dark ? "text-ink-text-muted" : "text-paper-text-muted"}`}>
                        from{" "}
                        <span className="font-display text-[26px] font-black">{formatINR(way.from)}</span>
                        {" "}per person
                      </span>
                      <span className={`mt-0.5 block text-[12.5px] ${way.dark ? "text-ink-text-faint" : "text-paper-text-faint"}`}>
                        {way.count}
                      </span>
                    </div>
                    <Magnetic>
                      {way.href.startsWith("#") ? (
                        <a
                          href={way.href}
                          className="flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[14.5px] font-bold text-white transition-colors hover:bg-accent-bright"
                        >
                          {way.cta} <ChevronIcon size={14} />
                        </a>
                      ) : (
                        <Link
                          href={way.href}
                          className="flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14.5px] font-bold text-ink-text transition-colors hover:bg-accent"
                        >
                          {way.cta} <ChevronIcon size={14} />
                        </Link>
                      )}
                    </Magnetic>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 3 — Leaving soon: group departures, sideways ------------------- */}
        <div id="departures" className="scroll-mt-0">
          <HorizontalGallery
            items={soonItems}
            allHref="/group-tours"
            allLabel={`All ${groupTours.length} group tours`}
            intro={
              <>
                <span className="eyebrow text-accent-bright">
                  <Editable id="home.soon.eyebrow" as="span">Group Tours</Editable>
                </span>
                <Editable
                  id="home.soon.heading"
                  as="h2"
                  className="mt-4 font-display text-[44px] font-black leading-[1.0] tracking-tight text-ink-text sm:text-[64px]"
                >
                  Leaving soon
                </Editable>
                <Editable
                  id="home.soon.body"
                  as="p"
                  multiline
                  className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink-text-muted"
                >
                  Real dates, real seat counts, one price per person. Pick a departure and join
                  the group — keep scrolling to see what&apos;s next.
                </Editable>
              </>
            }
          />
        </div>

        {/* 4 — Customized trip ideas, by occasion ------------------------- */}
        <section className="bg-paper py-24 sm:py-32">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <span data-reveal className="eyebrow text-accent-deep">
                  <Editable id="home.ideas.eyebrow" as="span">Customized Tours</Editable>
                </span>
                <div data-reveal="clip" style={{ "--reveal-delay": "80ms" }}>
                  <Editable
                    id="home.ideas.heading"
                    as="h2"
                    className="mt-3 font-display text-[36px] font-black leading-[1.03] tracking-tight text-paper-text sm:text-[54px]"
                  >
                    Trip ideas we&apos;ll build around you
                  </Editable>
                </div>
              </div>
              <div data-reveal style={{ "--reveal-delay": "160ms" }}>
                <Editable
                  id="home.ideas.body"
                  as="p"
                  multiline
                  className="max-w-sm text-[15px] leading-relaxed text-paper-text-muted"
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
        <section className="relative bg-ink py-24 sm:py-32">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            {/* min-w-0: a grid item's default min width is its content, and the
                ask bar's input would otherwise push this column off a phone. */}
            <div className="min-w-0 lg:sticky lg:top-[14svh] lg:self-start">
              <span data-reveal className="eyebrow text-accent-bright">
                <Editable id="home.how.eyebrow" as="span">How a customized trip works</Editable>
              </span>
              <div data-reveal="clip" style={{ "--reveal-delay": "80ms" }}>
                <Editable
                  id="home.how.heading"
                  as="h2"
                  className="mt-3 font-display text-[34px] font-black leading-[1.04] tracking-tight text-ink-text sm:text-[48px]"
                >
                  From idea to itinerary, before you pay a rupee.
                </Editable>
              </div>

              <div
                data-reveal
                style={{ "--reveal-delay": "160ms" }}
                className="mt-8 rounded-3xl border border-ink-line-strong bg-ink-soft/60 p-5 sm:p-6"
              >
                <p className="flex items-center gap-2 text-[14px] font-bold text-ink-text">
                  <SparkleIcon size={15} className="text-accent-bright" />
                  <Editable id="home.how.ask" as="span">Want a draft right now? Type a place.</Editable>
                </p>
                <p className="mt-1 text-[13px] text-ink-text-faint">
                  Our AI Trip Planner writes a day-by-day plan in about a minute. Free.
                </p>
                <div className="mt-4">
                  <AskBar />
                </div>
                <a
                  href={whatsapp}
                  {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="mt-4 inline-flex items-center gap-2 text-[13.5px] font-semibold text-ink-text-muted transition-colors hover:text-ink-text"
                >
                  {isWhatsApp ? <WhatsAppIcon size={15} /> : <ChatIcon size={15} />}
                  Or message a planner — a person replies the same day.
                </a>
              </div>
            </div>

            <StackCards
              cards={[
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
        </section>

        {/* 6 — Why YaadiGo ------------------------------------------------- */}
        <section className="bg-paper-dim py-24 sm:py-32">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="lg:sticky lg:top-[18svh]">
              <span data-reveal className="eyebrow text-accent-deep">
                <Editable id="home.why.eyebrow" as="span">Why YaadiGo</Editable>
              </span>
              <div data-reveal="clip" style={{ "--reveal-delay": "80ms" }}>
                <Editable
                  id="home.why.heading"
                  as="h2"
                  className="mt-3 font-display text-[34px] font-black leading-[1.05] tracking-tight text-paper-text sm:text-[46px]"
                >
                  Four things you can check before you trust us
                </Editable>
              </div>
              <div data-reveal style={{ "--reveal-delay": "160ms" }}>
                <Editable
                  id="home.why.body"
                  as="p"
                  multiline
                  className="mt-4 max-w-md text-[15px] leading-relaxed text-paper-text-muted"
                >
                  We have no review count to wave at you yet. So here is what you can verify on this
                  site instead, in about thirty seconds.
                </Editable>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {PROOF_POINTS.map(({ id, title, detail }, i) => {
                const Icon = PROOF_ICONS[i];
                return (
                  <div
                    key={id}
                    data-reveal="zoom"
                    style={{ "--reveal-delay": `${i * 90}ms` }}
                    className="group flex flex-col gap-4 rounded-3xl border border-paper-line bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl hover:shadow-ink/5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent-deep transition-all duration-500 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
                      <Icon size={20} />
                    </span>
                    <div>
                      {/* Keyed on the point's own id, not its position, so an
                          edit survives this list being reordered. */}
                      <Editable id={`home.proof.${id}.title`} as="h3" className="text-[16px] font-bold text-paper-text">
                        {title}
                      </Editable>
                      <Editable
                        id={`home.proof.${id}.detail`}
                        as="p"
                        multiline
                        className="mt-1.5 text-[13.5px] leading-relaxed text-paper-text-muted"
                      >
                        {detail}
                      </Editable>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 7 — Travel guides ----------------------------------------------- */}
        <section className="bg-paper py-24 sm:py-28">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-10">
            <div className="flex items-end justify-between gap-6">
              <div>
                <span data-reveal className="eyebrow text-accent-deep">
                  <Editable id="home.guides.eyebrow" as="span">From the journal</Editable>
                </span>
                <div data-reveal="clip" style={{ "--reveal-delay": "80ms" }}>
                  <Editable
                    id="home.guides.heading"
                    as="h2"
                    className="mt-3 font-display text-[34px] font-black leading-[1.05] tracking-tight text-paper-text sm:text-[46px]"
                  >
                    Still deciding? Read this first.
                  </Editable>
                </div>
              </div>
              <Link
                href="/blog"
                className="hidden shrink-0 items-center gap-1.5 text-[14px] font-bold text-paper-text sm:flex"
              >
                All guides <ChevronIcon size={14} />
              </Link>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {posts.map((post, i) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 100}ms` }}
                  className="group flex flex-col"
                >
                  <div className="relative aspect-[3/2] overflow-hidden rounded-3xl bg-paper-dim">
                    {post.image && (
                      <Image
                        src={post.image.src}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                      />
                    )}
                  </div>
                  <h3 className="mt-4 font-display text-[20px] font-bold leading-snug text-paper-text transition-colors group-hover:text-accent-deep">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-paper-text-muted">
                    {post.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 8 — Close: a person, plus the one corporate line ----------------- */}
        <ParallaxBackdrop src={closePhoto.src} alt={closePhoto.alt} veil="bg-ink/60">
          <div className="mx-auto w-full max-w-5xl px-6 pb-14 pt-28 text-center sm:px-10 sm:pt-40">
            <div data-reveal="clip">
              <Editable
                id="home.close2.heading"
                as="h2"
                className="mx-auto max-w-3xl font-display text-[40px] font-black leading-[1.02] tracking-tight text-white sm:text-[72px]"
              >
                Not sure yet? Ask a person.
              </Editable>
            </div>
            <div data-reveal style={{ "--reveal-delay": "120ms" }}>
              <Editable
                id="home.close2.body"
                as="p"
                multiline
                className="mx-auto mt-6 max-w-lg text-[16px] leading-relaxed text-white/80"
              >
                Tell us roughly where and when. A planner replies the same day in business hours —
                with options, not a sales pitch.
              </Editable>
            </div>

            <div
              data-reveal="zoom"
              style={{ "--reveal-delay": "220ms" }}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Magnetic>
                <a
                  href={whatsapp}
                  {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-7 py-4 text-[15px] font-bold text-white shadow-xl shadow-[#25D366]/30"
                >
                  {isWhatsApp ? <WhatsAppIcon size={18} /> : <ChatIcon size={18} />}
                  {isWhatsApp ? "WhatsApp a planner" : "Send a quick enquiry"}
                </a>
              </Magnetic>
              {CONTACT.phoneHref && (
                <Magnetic>
                  <a
                    href={`tel:${CONTACT.phoneHref}`}
                    className="flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-bold text-ink transition-colors hover:bg-paper"
                  >
                    Call {CONTACT.phone}
                  </a>
                </Magnetic>
              )}
            </div>

            {/* The only corporate content on this page — by design. */}
            <p className="mt-24 border-t border-white/15 pt-6 text-[13.5px] text-white/60">
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
