import Link from "next/link";
import { MapIcon, ChevronIcon, SparkleIcon, CheckIcon } from "./icons";

const HIGHLIGHTS = [
  "Free draft itinerary before you pay anything",
  "Fixed departures with dates and seats you can see",
  "GST-assured invoicing on every corporate booking",
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink">
      {/* Layered ambient light — two offset emerald glows plus a fine grid.
          All CSS, so the hero costs nothing to download and never shifts. */}

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-16 pt-14 sm:px-10 sm:pb-24 sm:pt-20">
        <div className="max-w-3xl">
          <span
            data-reveal
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-line-strong bg-ink-soft/60 px-3.5 py-1.5 eyebrow text-ink-text-muted backdrop-blur"
          >
            <MapIcon size={13} /> YaadiGo Networks Pvt Ltd
          </span>

          <h1
            data-reveal
            style={{ "--reveal-delay": "80ms" }}
            className="mt-6 font-display text-[38px] font-black leading-[1.05] tracking-tight text-ink-text sm:text-[60px]"
          >
            Trips we plan, tours we run, and a travel desk companies trust with{" "}
            <span className="text-accent-bright">
              the boring parts
            </span>
            .
          </h1>

          <p
            data-reveal
            style={{ "--reveal-delay": "160ms" }}
            className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-ink-text-muted"
          >
            Fixed-departure group tours, fully customized itineraries, and a dedicated Corporate
            Travel Desk for companies that need reliable, GST-compliant business travel — not
            another app to learn.
          </p>

          <div
            data-reveal
            style={{ "--reveal-delay": "240ms" }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link
              href="/plan"
              className="group flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[14.5px] font-bold text-white shadow-lg shadow-accent/25 transition-transform hover:scale-[1.04]"
            >
              <SparkleIcon size={16} />
              Plan my trip with AI
              <ChevronIcon size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/group-tours"
              className="rounded-full border border-ink-line-strong px-6 py-3.5 text-[14.5px] font-bold text-ink-text transition-colors hover:border-accent/60"
            >
              Browse group tours
            </Link>
          </div>

          <ul
            data-reveal
            style={{ "--reveal-delay": "320ms" }}
            className="mt-7 flex flex-wrap gap-x-6 gap-y-2"
          >
            {HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1.5 text-[13px] font-medium text-ink-text-faint"
              >
                <span className="text-accent">
                  <CheckIcon size={13} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            data-reveal
            href="/customized-tours"
            className="group relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-ink-line bg-ink-soft/80 p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-accent/50 sm:p-7"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent opacity-0 transition-opacity group-hover:opacity-100"
            />
            <div>
              <span className="eyebrow text-accent">
                For travellers
              </span>
              <h2 className="mt-2.5 font-display text-[23px] font-bold text-ink-text">
                Plan a trip
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-text-faint">
                Join a fixed-departure group tour, or tell us your dates and budget and we&apos;ll
                design something just for you.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink-text">
              Explore trips
              <ChevronIcon size={15} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <Link
            data-reveal
            style={{ "--reveal-delay": "100ms" }}
            href="/corporate-travel"
            className="group relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-ink-line bg-ink-soft/80 p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-accent/50 sm:p-7"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent opacity-0 transition-opacity group-hover:opacity-100"
            />
            <div>
              <span className="eyebrow text-brass">
                For companies
              </span>
              <h2 className="mt-2.5 font-display text-[23px] font-bold text-ink-text">
                Corporate Travel Desk
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-text-faint">
                A named travel executive, a prepaid wallet instead of a credit application, and an AI agent that keeps GST reconciliation straight —
                built for teams that fly often and can&apos;t afford slow approvals.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink-text">
              See the Corporate Travel Desk
              <ChevronIcon size={15} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
