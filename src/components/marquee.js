import Link from "next/link";
import { getTrips } from "@/lib/cms/catalogue";

/**
 * A continuously scrolling destinations ticker.
 *
 * Pure CSS: the track holds the list twice and translates exactly -50%, so
 * the loop is seamless with no JS, no rAF and nothing to schedule. It pauses
 * on hover so you can actually read and click an item — a ticker you can't
 * catch is decoration, not navigation.
 *
 * Under prefers-reduced-motion the animation is neutralised globally in
 * globals.css, leaving a static, scrollable row.
 */
export default async function Marquee({ tone = "ink" }) {
  const trips = await getTrips();
  const items = trips.map((tour) => ({
    slug: tour.slug,
    label: tour.destination.split("·")[0].trim(),
    price: tour.price,
  }));

  const dark = tone === "ink";

  return (
    <div
      className={`marquee relative flex overflow-hidden border-y ${
        dark ? "border-ink-line bg-ink" : "border-paper-line bg-paper-dim"
      }`}
    >

      <div className="animate-marquee flex shrink-0 items-center gap-8 py-3.5 pr-8">
        {/* Rendered twice: the second copy is what the first scrolls into. */}
        {[0, 1].map((copy) =>
          items.map((item) => (
            <Link
              key={`${copy}-${item.slug}`}
              href={`/group-tours/${item.slug}`}
              // The duplicate set is decorative — keep it out of the a11y tree
              // and the tab order so the list isn't announced twice.
              aria-hidden={copy === 1 ? "true" : undefined}
              tabIndex={copy === 1 ? -1 : undefined}
              className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap"
            >
              <span
                className={`h-1 w-1 rounded-full ${dark ? "bg-accent-bright" : "bg-accent"}`}
                aria-hidden="true"
              />
              <span
                className={`font-display text-[15px] font-semibold transition-colors ${
                  dark
                    ? "text-ink-text-muted group-hover:text-ink-text"
                    : "text-paper-text-muted group-hover:text-paper-text"
                }`}
              >
                {item.label}
              </span>
              <span
                className={`text-[12px] font-semibold tabular-nums ${
                  dark ? "text-ink-text-faint" : "text-paper-text-faint"
                }`}
              >
                from ₹{item.price.toLocaleString("en-IN")}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
