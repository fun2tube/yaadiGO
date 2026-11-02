import Link from "next/link";
import NeuralField from "@/components/neural-field";
import TourCard from "@/components/tour-card";
import CountUp from "@/components/count-up";
import ImageField from "./image-field";
import { PADDING, TONE, token, optionsOf } from "@/lib/cms/blocks";
import { getImage } from "@/lib/media";
import {
  SparkleIcon,
  ChevronIcon,
  MapIcon,
  UsersIcon,
  WalletIcon,
  ShieldIcon,
  WhatsAppIcon,
} from "@/components/icons";

/**
 * The site's real sections, as blocks.
 *
 * The six generic blocks (heading, paragraph, cards…) prove the builder works
 * but produce a page that looks like any builder's output. These are the
 * opposite: the actual YaadiGo hero, trip rail and proof panel, with their
 * NeuralField, their type scale and their live inventory — now draggable,
 * reorderable and editable.
 *
 * Two constraints carried over from the generic blocks:
 *
 *   **Live data comes through `metadata`, never props.** A block cannot fetch.
 *   The page fetches once and passes trips and stats down, so a built page
 *   shows today's seat counts rather than a snapshot frozen at publish time.
 *   Puck hands every block `{ puck: { metadata } }`.
 *
 *   **Sizes stay stepped.** These sections expose spacing and tone, not pixels,
 *   for the same reason as everything else: no setting may produce a layout
 *   that breaks at 360px.
 */

const PROOF_ICONS = [UsersIcon, MapIcon, WalletIcon, ShieldIcon];

export const Hero = {
  label: "Hero (YaadiGo)",
  fields: {
    eyebrow: { type: "text", label: "Badge text" },
    heading: { type: "textarea", label: "Headline" },
    subheading: { type: "textarea", label: "Sub-headline" },
    primaryLabel: { type: "text", label: "Main button" },
    primaryHref: { type: "text", label: "Main button link" },
    secondaryLabel: { type: "text", label: "Second button" },
    secondaryHref: { type: "text", label: "Second button link" },
    showStats: {
      type: "radio",
      label: "Show the live stats row",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    padding: { type: "select", label: "Spacing", options: optionsOf(PADDING) },
  },
  defaultProps: {
    eyebrow: "YaadiGo Networks Pvt Ltd",
    heading: "The whole trip, written down before you pay a rupee.",
    subheading:
      "Group departures and custom itineraries across India and Asia. Our AI planner drafts every day — real places, real transfer times, an honest read on your dates — free, and before you speak to anyone.",
    primaryLabel: "Plan my trip with AI",
    primaryHref: "/plan",
    secondaryLabel: "WhatsApp us",
    secondaryHref: "/contact",
    showStats: true,
    padding: "roomy",
  },
  render: ({
    eyebrow,
    heading,
    subheading,
    primaryLabel,
    primaryHref,
    secondaryLabel,
    secondaryHref,
    showStats,
    padding,
    puck,
  }) => {
    const stats = puck?.metadata?.stats ?? [];
    return (
      <section className="relative overflow-hidden bg-ink text-ink-text">
        <NeuralField density={1.25} />
        <div
          className={`relative mx-auto w-full max-w-6xl px-6 sm:px-10 ${token(
            PADDING,
            padding,
            "roomy"
          )}`}
        >
          {eyebrow ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-line-strong bg-ink-soft/60 px-3.5 py-1.5 eyebrow text-ink-text-muted backdrop-blur">
              <MapIcon size={12} /> {eyebrow}
            </span>
          ) : null}

          <h1 className="mt-6 max-w-3xl font-display text-[38px] font-black leading-[1.03] tracking-tight sm:text-[64px]">
            {heading}
          </h1>

          {subheading ? (
            <p className="mt-5 max-w-lg whitespace-pre-line text-[15.5px] leading-relaxed text-ink-text-muted sm:text-[17px]">
              {subheading}
            </p>
          ) : null}

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {primaryLabel ? (
              <Link
                href={primaryHref || "/plan"}
                className="group flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-[15px] font-bold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98] sm:py-3.5"
              >
                <SparkleIcon size={17} /> {primaryLabel}
                <ChevronIcon size={15} className="transition-transform group-hover:translate-x-1" />
              </Link>
            ) : null}
            {secondaryLabel ? (
              <a
                href={secondaryHref || "/contact"}
                className="flex items-center justify-center gap-2 rounded-full border border-ink-line-strong px-6 py-4 text-[15px] font-bold text-ink-text transition-colors hover:border-accent/60 sm:py-3.5"
              >
                <WhatsAppIcon size={17} /> {secondaryLabel}
              </a>
            ) : null}
          </div>

          {/* Derived from the catalogue, never typed in. An editor can hide the
              row but cannot put a number in it — which is the whole reason
              these figures are trustworthy. */}
          {showStats && stats.length > 0 ? (
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-4 border-t border-ink-line pt-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <span className="font-display text-[24px] font-black text-ink-text">
                    <CountUp value={s.value} prefix={s.prefix ?? ""} suffix={s.suffix} />
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-text-faint">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    );
  },
};

export const TripRail = {
  label: "Trip rail (live)",
  fields: {
    eyebrow: { type: "text", label: "Small label" },
    heading: { type: "text", label: "Heading" },
    linkLabel: { type: "text", label: "Link text" },
    linkHref: { type: "text", label: "Link" },
    limit: {
      type: "select",
      label: "How many trips",
      options: [
        { label: "Four", value: 4 },
        { label: "Six", value: 6 },
        { label: "All", value: 99 },
      ],
    },
    tone: { type: "select", label: "Background", options: optionsOf(TONE) },
    padding: { type: "select", label: "Spacing", options: optionsOf(PADDING) },
  },
  defaultProps: {
    eyebrow: "Group Tours",
    heading: "Fixed departures, ready to join",
    linkLabel: "View all",
    linkHref: "/group-tours",
    limit: 6,
    tone: "paper",
    padding: "normal",
  },
  render: ({ eyebrow, heading, linkLabel, linkHref, limit, tone, padding, puck }) => {
    const trips = (puck?.metadata?.trips ?? []).slice(0, limit ?? 6);

    // Nothing to show is not an error — it means the catalogue is empty or
    // every batch sold out. An empty rail with a heading above it looks broken,
    // so the whole section goes.
    if (trips.length === 0) return null;

    return (
      <section className={token(TONE, tone, "paper")}>
        <div className={`mx-auto w-full max-w-6xl ${token(PADDING, padding, "normal")}`}>
          <div className="flex items-end justify-between gap-4 px-6 sm:px-10">
            <div>
              {eyebrow ? (
                <span className="eyebrow text-accent-deep">{eyebrow}</span>
              ) : null}
              <h2 className="mt-2 font-display text-[28px] font-black tracking-tight sm:text-[38px]">
                {heading}
              </h2>
            </div>
            {linkLabel ? (
              <Link
                href={linkHref || "/group-tours"}
                className="hidden shrink-0 items-center gap-1 text-[13.5px] font-bold sm:flex"
              >
                {linkLabel} <ChevronIcon size={14} />
              </Link>
            ) : null}
          </div>

          {/* The same horizontal rail as the coded page — swipe sideways inside
              a page you swipe vertically, which is the gesture people already
              know from app home screens. */}
          <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 sm:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {trips.map((tour, i) => (
              <div
                key={tour.slug}
                className="w-[78vw] max-w-[320px] shrink-0 snap-start sm:w-[300px]"
              >
                <TourCard tour={tour} index={i} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
};

export const ProofPanel = {
  label: "Proof points (YaadiGo)",
  fields: {
    eyebrow: { type: "text", label: "Small label" },
    heading: { type: "text", label: "Heading" },
    intro: { type: "textarea", label: "Intro line" },
    items: {
      type: "array",
      label: "Points",
      arrayFields: {
        title: { type: "text", label: "Title" },
        detail: { type: "textarea", label: "Detail" },
      },
      defaultItemProps: { title: "A checkable claim", detail: "Why a visitor can verify it." },
    },
    tone: { type: "select", label: "Background", options: optionsOf(TONE) },
    padding: { type: "select", label: "Spacing", options: optionsOf(PADDING) },
  },
  defaultProps: {
    eyebrow: "Why YaadiGo",
    heading: "Four things you can check before you trust us",
    intro:
      "We have no review count to wave at you yet. So here is what you can verify on this site instead, in about thirty seconds.",
    items: [
      {
        title: "The seat counts are real",
        detail:
          "Every departure on this site shows the seats actually left in that batch. When it says two, it is two.",
      },
      {
        title: "The itinerary is written before you pay",
        detail:
          "Weather risk, permits and likely closures are on the page before any money moves.",
      },
      {
        title: "Nothing is payable until you approve",
        detail: "Draft itineraries are free and revised as many times as it takes.",
      },
      {
        title: "A registered company, not a marketplace",
        detail: "You deal with us start to finish — not a lead form passed to five agents.",
      },
    ],
    tone: "paper",
    padding: "normal",
  },
  render: ({ eyebrow, heading, intro, items, tone, padding }) => (
    <section className={token(TONE, tone, "paper")}>
      <div
        className={`mx-auto w-full max-w-5xl px-6 sm:px-10 ${token(PADDING, padding, "normal")}`}
      >
        {eyebrow ? <span className="eyebrow text-accent-deep">{eyebrow}</span> : null}
        <h2 className="mt-2 font-display text-[30px] font-black leading-[1.1] tracking-tight sm:text-[40px]">
          {heading}
        </h2>
        {intro ? (
          <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed opacity-75">{intro}</p>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(items ?? []).map((item, i) => {
            const Icon = PROOF_ICONS[i % PROOF_ICONS.length];
            return (
              <div
                key={i}
                className="flex gap-4 rounded-2xl border border-current/10 bg-current/[0.03] p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-deep">
                  <Icon size={19} />
                </span>
                <div>
                  <h3 className="text-[14.5px] font-bold">{item.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed opacity-75">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  ),
};

export const Banner = {
  label: "Image banner",
  fields: {
    imageId: {
      type: "custom",
      label: "Photo",
      render: ({ value, onChange }) => <ImageField value={value} onChange={onChange} />,
    },
    heading: { type: "textarea", label: "Headline over the image" },
    buttonLabel: { type: "text", label: "Button" },
    buttonHref: { type: "text", label: "Button link" },
    height: {
      type: "select",
      label: "Height",
      options: [
        { label: "Short", value: "short" },
        { label: "Tall", value: "tall" },
      ],
    },
  },
  defaultProps: {
    imageId: "site-hero-himalaya",
    heading: "",
    buttonLabel: "",
    buttonHref: "/plan",
    height: "short",
  },
  render: ({ imageId, heading, buttonLabel, buttonHref, height }) => {
    const bannerImage = getImage(imageId);
    return (
    <section
      className={`relative overflow-hidden bg-ink text-ink-text ${
        height === "tall" ? "min-h-[70vh]" : "min-h-[40vh]"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fills an
          arbitrary-height banner; next/image fill needs a sized parent that
          the editor can change underneath it.

          The URL comes from the media library rather than being rebuilt as
          `/media/${imageId}.jpg`. Every entry happens to be a .jpg today, so
          the old form worked — but it would 404 silently the first time
          somebody adds a PNG or a WebP, and the editor lets them pick one.

          alt="" is correct and deliberate: this sits at opacity-45 behind the
          heading, which carries the meaning. Announcing it twice would be
          noise for a screen-reader user. */}
      <img
        src={bannerImage?.src ?? `/media/${imageId}.jpg`}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-center px-6 py-16 sm:px-10">
        {heading ? (
          <h2 className="max-w-2xl font-display text-[30px] font-black leading-[1.08] tracking-tight sm:text-[44px]">
            {heading}
          </h2>
        ) : null}
        {buttonLabel ? (
          <Link
            href={buttonHref || "/plan"}
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[15px] font-bold text-white"
          >
            {buttonLabel} <ChevronIcon size={15} />
          </Link>
        ) : null}
      </div>
    </section>
    );
  },
};
