import Link from "next/link";
import { CalendarIcon, UsersIcon, ChevronIcon } from "./icons";
import Img from "./img";
import { getImage } from "@/lib/media";

/**
 * One tour card, shared by the homepage preview and the /group-tours listing
 * so the two can't drift apart.
 *
 * The artwork is a per-theme CSS gradient rather than a photo: no asset
 * pipeline, no layout shift, nothing to download. Swap `<div>` for
 * next/image when real photography exists — the card geometry is already
 * sized for it.
 */

// Flat colour per theme — no gradients anywhere on the site. The card gets
// its depth from the hairline grid drawn over it, not from a fade.
const THEME_ART = {
  Mountains: "#2C3340",
  Beach: "#1F4A4E",
  Culture: "#7A3320",
  Relaxation: "#5C4A24",
};

const DEFAULT_ART = "#262522";

export default function TourCard({ tour, index = 0 }) {
  // Under six seats is the point at which "seats left" is information rather
  // than decoration, so only then does it get the warning treatment.
  const scarce = tour.seatsLeft <= 5;
  // Resolved on the server by the catalogue, so a client-side listing can still
  // render an admin-chosen photo. See withCardImages() in lib/cms/catalogue.js.
  const imageId = tour.cardImageId ?? tour.slug;
  const hasPhoto = !tour.cardImageHidden && Boolean(getImage(imageId));

  return (
    <Link
      data-reveal
      style={{ "--reveal-delay": `${Math.min(index, 5) * 70}ms` }}
      href={`/group-tours/${tour.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-paper-line bg-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-ink/10"
    >
      <div className="relative h-40 w-full overflow-hidden">
        {/* The photo is keyed to the trip slug in the media library. Trips
            without one fall back to the flat theme colour rather than a
            broken frame, so adding photography is purely additive. */}
        {hasPhoto ? (
          <Img
            id={imageId}
            cmsId={tour.cardImageCmsId}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div
            className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
            style={{ background: THEME_ART[tour.theme] ?? DEFAULT_ART }}
          />
        )}
        {/* Scrim so the white badges stay legible over any photo. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-24 bg-ink/45"
          style={{ maskImage: "linear-gradient(to top, #000 30%, transparent)" }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <span className="rounded-md bg-white/15 px-2 py-1 eyebrow text-white backdrop-blur-sm">
            {tour.theme}
          </span>
          <span className="rounded-md bg-white/95 px-2.5 py-1 text-[12px] font-black text-paper-text">
            {tour.duration}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-paper-text-faint">
            {tour.destination}
          </span>
          <h3 className="mt-1 font-display text-[18px] font-bold leading-snug text-paper-text">
            {tour.title}
          </h3>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-paper-text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarIcon size={13} /> {tour.nextDeparture}
          </span>
          <span
            className={`flex items-center gap-1.5 font-semibold ${
              scarce ? "text-warn" : "text-paper-text-muted"
            }`}
          >
            <UsersIcon size={13} /> {tour.seatsLeft} seats left
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-paper-line pt-3.5">
          <span className="font-display text-[18px] font-black text-paper-text">
            ₹{tour.price.toLocaleString("en-IN")}
            <span className="text-[12px] font-medium text-paper-text-faint"> /person</span>
          </span>
          <span className="flex items-center gap-1 text-[13px] font-bold text-accent-deep transition-transform group-hover:translate-x-1">
            View <ChevronIcon size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}
