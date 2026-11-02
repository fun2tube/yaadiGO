import Link from "next/link";
import { ChevronIcon, CalendarIcon } from "./icons";
import Img from "./img";
import { getImage } from "@/lib/media";

/**
 * A customised package card.
 *
 * Deliberately different from TourCard: no departure date, no seat count, no
 * "reserve" language. A package has a "from" price and a duration RANGE,
 * because the whole product is that you change it. Showing scarcity on
 * something with no fixed inventory would be an invented pressure.
 */

const THEME_ART = {
  Mountains: "#2C3340",
  Beach: "#1F4A4E",
  Culture: "#7A3320",
  Relaxation: "#5C4A24",
  Wildlife: "#33402C",
  Pilgrimage: "#402C3A",
  Nature: "#2C4033",
};

export default function PackageCard({ pkg, index = 0 }) {
  // Resolved server-side by the catalogue — see withCardImages().
  const imageId = pkg.cardImageId ?? pkg.slug;
  return (
    <Link
      data-reveal
      style={{ "--reveal-delay": `${Math.min(index, 5) * 60}ms` }}
      href={`/customized-tours/${pkg.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-paper-line bg-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-ink/10"
    >
      <div className="relative h-32 w-full overflow-hidden">
        {getImage(imageId) ? (
          <Img
            id={imageId}
            cmsId={pkg.cardImageCmsId}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div
            className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
            style={{ background: THEME_ART[pkg.theme] ?? "#262522" }}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-20 bg-ink/45"
          style={{ maskImage: "linear-gradient(to top, #000 30%, transparent)" }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5">
          <span className="rounded-md bg-white/15 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            {pkg.theme}
          </span>
          <span className="rounded-md bg-white/95 px-2 py-1 text-[11.5px] font-bold text-paper-text">
            {pkg.duration}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint">
            {pkg.destination}
          </span>
          <h3 className="mt-1 font-display text-[17px] font-bold leading-snug text-paper-text">
            {pkg.title}
          </h3>
        </div>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-paper-text-muted">
          {pkg.heroNote}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {pkg.idealFor.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-paper-dim px-2 py-0.5 text-[11px] font-semibold text-paper-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-paper-line pt-3">
          <span className="text-[15px] font-bold text-paper-text">
            <span className="text-[11px] font-medium text-paper-text-faint">from </span>₹
            {pkg.fromPrice.toLocaleString("en-IN")}
          </span>
          <span className="flex items-center gap-1 text-[12.5px] font-bold text-accent-deep transition-transform group-hover:translate-x-1">
            Customise <ChevronIcon size={12} />
          </span>
        </div>

        <span className="flex items-center gap-1 font-mono text-[10px] text-paper-text-faint">
          <CalendarIcon size={10} /> Best {pkg.bestTime}
        </span>
      </div>
    </Link>
  );
}
