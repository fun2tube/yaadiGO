import Link from "next/link";
import Image from "next/image";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import Editable from "@/components/cms/editable";
import AskBar from "@/components/ask-bar";
import BuiltPage from "@/components/builder/render";
import TripIdeas from "@/components/motion/trip-ideas";
import { getPublishedLayout } from "@/lib/cms/pages";
import { getTrips, getDestinations } from "@/lib/cms/catalogue";
import { getImage } from "@/lib/media";
import { sortedPosts } from "@/lib/posts";
import { siteProof, PROOF_POINTS } from "@/lib/proof";
import { quickEnquiryHref, CORPORATE_URL, CONTACT } from "@/lib/site";
import {
  SparkleIcon,
  CheckIcon,
  ChevronIcon,
  ArrowIcon,
  CalendarIcon,
  UsersIcon,
  MapIcon,
  WalletIcon,
  ShieldIcon,
  WhatsAppIcon,
  ChatIcon,
} from "@/components/icons";

// The plan behind this page: docs/design/homepage-clear.md (2026-10-11).
// In one line: the AI planner is the front door, the two ways to travel
// follow, and nothing on the page moves unless it helps someone decide.

// Matched to PROOF_POINTS by position; that module stays server/browser
// agnostic, so the icons live here.
const PROOF_ICONS = [UsersIcon, MapIcon, WalletIcon, ShieldIcon];

const HERO_PHOTO = "hero-himalaya-hikers";

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

/** Resolve a media-library id to its src, alt and title. */
function photo(id) {
  const image = getImage(id);
  return image ? { id, src: image.src, alt: image.alt, title: image.title } : null;
}

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

  const hero = photo(HERO_PHOTO);
  const groupPhoto = photo("way-group");
  const privatePhoto = photo("way-private");

  const ways = [
    {
      key: "group",
      name: "Group Tours",
      line: "Join a small group on a fixed date.",
      image: groupPhoto,
      facts: [
        "Set departure dates — pick one",
        "Travel with a small group",
        "One all-in price per person",
        "Best for solo travellers and friends",
      ],
      from: groupFrom,
      count: `${departures.length} departures open`,
      cta: "See departures",
      href: "#departures",
    },
    {
      key: "custom",
      name: "Customized Tours",
      line: "Your own private trip, on your dates.",
      image: privatePhoto,
      facts: [
        "Any dates you want",
        "Only your people",
        "Free day-by-day draft before you pay",
        "Best for families, couples and honeymoons",
      ],
      from: customFrom,
      count: `${destinations.length} trip ideas, or any place you name`,
      cta: "Start planning",
      href: "/customized-tours",
    },
  ];

  return (
    <>
      <Reveal />
      <SiteNav />

      <main className="bg-white">
        {/* 1 — Hero: the AI planner, first ------------------------------------ */}
        <section className="relative isolate overflow-hidden bg-ink">
          {hero && (
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              preload
              sizes="100vw"
              className="-z-10 object-cover"
            />
          )}
          {/* Legibility: a wash heavier on the left, where the text sits —
              a masked solid, not a gradient fill. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink/35" />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-ink/55"
            style={{ maskImage: "linear-gradient(to right, #000 25%, transparent 80%)" }}
          />

          <div className="mx-auto flex min-h-[640px] max-w-7xl flex-col justify-center px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:min-h-[86svh] lg:px-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm">
                <SparkleIcon size={14} />
                <Editable id="home.hero.badge" as="span">Free AI Trip Planner</Editable>
              </span>

              <Editable
                id="home.hero.heading"
                as="h1"
                className="mt-5 font-display text-[38px] font-extrabold leading-[1.08] text-white [text-wrap:balance] sm:text-[54px] lg:text-[62px]"
              >
                Plan your dream trip in a minute
              </Editable>

              <Editable
                id="home.hero.body"
                as="p"
                multiline
                className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-white/90 sm:text-[18px]"
              >
                Tell us where you want to go. Our free AI planner writes your day-by-day itinerary,
                then a YaadiGo travel expert turns it into a trip you can book.
              </Editable>

              <div className="mt-8">
                <AskBar />
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-medium text-white/90">
                {["Free, no sign-up", "Day-by-day plan in about a minute", "A real expert checks every trip"].map(
                  (point) => (
                    <li key={point} className="flex items-center gap-2">
                      <CheckIcon size={15} color="currentColor" className="text-white" />
                      {point}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Live numbers, right under the fold line. */}
        <section aria-label="YaadiGo in numbers" className="border-b border-paper-line bg-white">
          <dl className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-paper-line px-2 py-6 sm:px-6 lg:px-8">
            {[
              { value: departures.length, label: "group departures open" },
              { value: groupTours.length + destinations.length, label: "trips in India & abroad" },
              { value: `₹${stats[2].value}`, label: "to pay until you approve" },
            ].map((s) => (
              <div key={s.label} className="px-3 text-center sm:px-6">
                <dt className="font-display text-[26px] font-extrabold text-paper-text sm:text-[32px]">{s.value}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-snug text-paper-text-muted sm:text-[14px]">{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 2 — How the AI planner works ---------------------------------------- */}
        <section className="bg-accent-soft/45 py-16 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div data-reveal>
              <SectionHeading
                eyebrowId="home.ai.eyebrow"
                eyebrow="How it works"
                titleId="home.ai.heading"
                title="From an idea to a bookable trip in three steps"
              />
              <ol className="mt-8 flex flex-col gap-5">
                {[
                  ["1", "Tell us where and when", "Type a place — or say it. Add dates, who is coming and a budget if you like."],
                  ["2", "Get your day-by-day plan", "Our AI writes the whole itinerary in about a minute: stays, timings, food, tips. Free."],
                  ["3", "An expert prices and books it", "A YaadiGo planner checks it, quotes it, and changes anything you want. You pay only when you approve."],
                ].map(([n, title, detail]) => (
                  <li key={n} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-display text-[17px] font-extrabold text-white">
                      {n}
                    </span>
                    <div>
                      <Editable id={`home.ai.step${n}.title`} as="h3" className="text-[17px] font-bold text-paper-text">
                        {title}
                      </Editable>
                      <Editable id={`home.ai.step${n}.detail`} as="p" className="mt-1 text-[15px] leading-relaxed text-paper-text-muted">
                        {detail}
                      </Editable>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/plan"
                className="mt-9 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-accent-deep"
              >
                <SparkleIcon size={16} /> Try the AI planner
              </Link>
            </div>

            {/* What you actually get — an example, labelled as one. */}
            <div data-reveal style={{ "--reveal-delay": "120ms" }} className="mx-auto w-full max-w-md">
              <div className="rounded-2xl bg-white p-5 shadow-[0_24px_60px_-28px_rgb(26_25_23/0.35)] ring-1 ring-paper-line sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-accent-soft px-2 py-1 text-[12px] font-bold text-accent-deep">
                    Example plan
                  </span>
                  <span className="text-[13px] font-semibold text-paper-text-muted">Ladakh · 6 days</span>
                </div>
                <p className="mt-3 font-display text-[20px] font-extrabold text-paper-text">High passes and quiet lakes</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {[
                    ["Day 1", "Arrive in Leh, rest and acclimatise"],
                    ["Day 2", "Shanti Stupa, Thiksey and the old town"],
                    ["Day 3", "Over Khardung La to Nubra's dunes"],
                    ["Day 4", "Along the Shyok to Pangong Lake"],
                  ].map(([day, text]) => (
                    <li key={day} className="flex items-start gap-3 rounded-xl bg-paper-dim/60 px-3.5 py-3">
                      <span className="w-12 shrink-0 text-[12.5px] font-bold text-accent-deep">{day}</span>
                      <span className="text-[14px] text-paper-text">{text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center justify-between border-t border-paper-line pt-3.5 text-[13px] text-paper-text-muted">
                  <span>Indicative cost per person</span>
                  <span className="font-bold text-paper-text">₹28,000 – ₹36,000</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3 — Two ways to travel ---------------------------------------------- */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div data-reveal className="max-w-2xl">
              <SectionHeading
                eyebrowId="home.ways.eyebrow"
                eyebrow="Two ways to travel"
                titleId="home.ways.heading"
                title="Join a group, or make it your own"
              />
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {ways.map((way, i) => {
                const Anchor = way.href.startsWith("#") ? "a" : Link;
                return (
                  <article
                    key={way.key}
                    data-reveal
                    style={{ "--reveal-delay": `${i * 100}ms` }}
                    className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-paper-line transition-shadow hover:shadow-[0_20px_50px_-28px_rgb(26_25_23/0.35)]"
                  >
                    <div className="relative aspect-[16/9] bg-paper-dim">
                      {way.image && (
                        <Image
                          src={way.image.src}
                          alt={way.image.alt}
                          fill
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-[24px] font-extrabold text-paper-text">{way.name}</h3>
                        <span className="text-[13px] font-semibold text-paper-text-muted">{way.count}</span>
                      </div>
                      <p className="mt-1 text-[16px] text-paper-text-muted">{way.line}</p>
                      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                        {way.facts.map((fact) => (
                          <li key={fact} className="flex gap-2 text-[14.5px] text-paper-text">
                            <CheckIcon size={16} color="currentColor" className="mt-0.5 shrink-0 text-good" />
                            {fact}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-7">
                        <span className="text-[14px] text-paper-text-muted">
                          from{" "}
                          <span className="font-display text-[22px] font-extrabold text-paper-text">
                            {formatINR(way.from)}
                          </span>{" "}
                          per person
                        </span>
                        <Anchor
                          href={way.href}
                          className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-[14.5px] font-bold text-ink-text transition-colors hover:bg-accent"
                        >
                          {way.cta} <ChevronIcon size={14} />
                        </Anchor>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4 — Upcoming group departures: a plain row you swipe or scroll -------- */}
        <section id="departures" className="scroll-mt-20 bg-paper-dim/60 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrowId="home.soon.eyebrow"
                eyebrow="Group Tours"
                titleId="home.soon.heading"
                title="Upcoming departures"
                bodyId="home.soon.body"
                body="Real dates, real seat counts, one price per person."
              />
              <Link href="/group-tours" className="inline-flex items-center gap-1.5 text-[15px] font-bold text-accent-deep hover:text-accent">
                All {groupTours.length} group tours <ArrowIcon size={16} />
              </Link>
            </div>
          </div>

          {soonItems.length > 0 ? (
            <div className="mx-auto mt-8 max-w-7xl">
              <ul className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 [scrollbar-width:thin] sm:px-6 lg:px-8">
                {soonItems.map((item) => (
                  <li key={item.key} className="w-[78vw] max-w-[320px] shrink-0 snap-start sm:w-[300px]">
                    <Link
                      href={item.href}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-paper-line transition-shadow hover:shadow-[0_20px_50px_-28px_rgb(26_25_23/0.35)]"
                    >
                      <div className="relative aspect-[4/3] bg-paper-dim">
                        <Image src={item.src} alt={item.alt} fill sizes="320px" className="object-cover" />
                        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-bold text-paper-text shadow-sm">
                          <CalendarIcon size={14} />
                          {item.date.day} {item.date.month}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <span className="text-[13px] font-medium text-paper-text-muted">{item.duration}</span>
                        <h3 className="mt-1 text-[17px] font-bold leading-snug text-paper-text group-hover:text-accent-deep">
                          {item.title}
                        </h3>
                        <div className="mt-auto flex items-center justify-between pt-4">
                          <span className="text-[14px] text-paper-text-muted">
                            <span className="text-[18px] font-extrabold text-paper-text">{formatINR(item.price)}</span> /person
                          </span>
                          <span
                            className={`rounded-md px-2 py-1 text-[12.5px] font-bold ${
                              item.seats <= 5 ? "bg-warn-soft text-warn" : "bg-paper-dim text-paper-text-muted"
                            }`}
                          >
                            {item.seats} {item.seats === 1 ? "seat" : "seats"} left
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mx-auto mt-8 max-w-7xl px-5 text-[15px] text-paper-text-muted sm:px-6 lg:px-8">
              New departure dates are being added. <Link href="/group-tours" className="font-bold text-accent-deep">See all group tours</Link>, or ask us for dates.
            </p>
          )}
        </section>

        {/* 5 — Customized trip ideas, by occasion ------------------------------- */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div data-reveal>
              <SectionHeading
                eyebrowId="home.ideas.eyebrow"
                eyebrow="Customized Tours"
                titleId="home.ideas.heading"
                title="Trip ideas we'll build around you"
                bodyId="home.ideas.body"
                body="Starting points, not packages. Your dates, your pace, your hotels — and a free draft before you decide."
              />
            </div>
            <TripIdeas
              ideas={ideas}
              occasions={occasions}
              allHref="/customized-tours"
              allLabel={`See all ${destinations.length} trip ideas`}
            />
          </div>
        </section>

        {/* 6 — Why YaadiGo ----------------------------------------------------- */}
        <section className="bg-paper-dim/60 py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <div data-reveal className="max-w-2xl">
              <SectionHeading
                eyebrowId="home.why.eyebrow"
                eyebrow="Why YaadiGo"
                titleId="home.why.heading"
                title="Four things you can check before you trust us"
              />
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PROOF_POINTS.map(({ id, title, detail }, i) => {
                const Icon = PROOF_ICONS[i];
                return (
                  <div
                    key={id}
                    data-reveal
                    style={{ "--reveal-delay": `${i * 80}ms` }}
                    className="rounded-2xl bg-white p-6 ring-1 ring-paper-line"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
                      <Icon size={20} />
                    </span>
                    {/* Keyed on the point's own id, so an edit survives reordering. */}
                    <Editable id={`home.proof.${id}.title`} as="h3" className="mt-4 text-[17px] font-bold text-paper-text">
                      {title}
                    </Editable>
                    <Editable
                      id={`home.proof.${id}.detail`}
                      as="p"
                      multiline
                      className="mt-1.5 text-[14.5px] leading-relaxed text-paper-text-muted"
                    >
                      {detail}
                    </Editable>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 7 — Travel guides --------------------------------------------------- */}
        {posts.length > 0 && (
          <section className="py-16 sm:py-24">
            <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
              <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
                <SectionHeading
                  eyebrowId="home.guides.eyebrow"
                  eyebrow="Travel guides"
                  titleId="home.guides.heading"
                  title="Still deciding? Read this first"
                />
                <Link href="/blog" className="inline-flex items-center gap-1.5 text-[15px] font-bold text-accent-deep hover:text-accent">
                  All guides <ArrowIcon size={16} />
                </Link>
              </div>
              <div className="mt-10 grid gap-6 md:grid-cols-3">
                {posts.map((post, i) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    data-reveal
                    style={{ "--reveal-delay": `${i * 80}ms` }}
                    className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-paper-line transition-shadow hover:shadow-[0_20px_50px_-28px_rgb(26_25_23/0.35)]"
                  >
                    <div className="relative aspect-[16/10] bg-paper-dim">
                      {post.image && (
                        <Image src={post.image.src} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-[17px] font-bold leading-snug text-paper-text group-hover:text-accent-deep">
                        {post.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-paper-text-muted">{post.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 8 — Close: a person ------------------------------------------------- */}
        <section className="px-5 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <div
            data-reveal
            className="mx-auto max-w-7xl rounded-3xl bg-accent px-6 py-12 text-center text-white sm:px-12 sm:py-16"
          >
            <Editable
              id="home.close.heading"
              as="h2"
              className="mx-auto max-w-2xl font-display text-[30px] font-extrabold leading-tight sm:text-[40px]"
            >
              Not sure yet? Talk to a person
            </Editable>
            <Editable
              id="home.close.body"
              as="p"
              multiline
              className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-white/90 sm:text-[17px]"
            >
              Tell us roughly where and when. A planner replies the same day in business hours — with
              options, not a sales pitch.
            </Editable>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={whatsapp}
                {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-bold text-paper-text transition-colors hover:bg-paper"
              >
                {isWhatsApp ? <WhatsAppIcon size={18} className="text-good" /> : <ChatIcon size={18} />}
                {isWhatsApp ? "WhatsApp a planner" : "Send a quick enquiry"}
              </a>
              {CONTACT.phoneHref && (
                <a
                  href={`tel:${CONTACT.phoneHref}`}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-bold text-white ring-1 ring-white/60 transition-colors hover:bg-white/10"
                >
                  Call {CONTACT.phone}
                </a>
              )}
            </div>
          </div>

          {/* The only corporate content on this page — by design. */}
          <p className="mx-auto mt-6 max-w-7xl text-center text-[14px] text-paper-text-muted">
            Booking travel for your company?{" "}
            <a href={CORPORATE_URL} className="font-bold text-paper-text underline-offset-4 hover:underline">
              Corporate Travel Desk →
            </a>
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/** The label, heading and optional line every section opens with. */
function SectionHeading({ eyebrowId, eyebrow, titleId, title, bodyId, body }) {
  return (
    <div>
      <Editable id={eyebrowId} as="p" className="eyebrow text-accent-deep">
        {eyebrow}
      </Editable>
      <Editable
        id={titleId}
        as="h2"
        className="mt-2 font-display text-[28px] font-extrabold leading-tight text-paper-text [text-wrap:balance] sm:text-[38px]"
      >
        {title}
      </Editable>
      {body && (
        <Editable id={bodyId} as="p" multiline className="mt-3 max-w-xl text-[16px] leading-relaxed text-paper-text-muted">
          {body}
        </Editable>
      )}
    </div>
  );
}
