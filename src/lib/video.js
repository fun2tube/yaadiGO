import { VIDEOS } from "@/lib/site";

/**
 * Turning a pasted social link into something the site can play.
 *
 * Kept out of the component on purpose: this is parsing, not rendering, and
 * the failure mode is silent — an unrecognised URL shows nothing, so a video
 * the desk pasted simply never appears and nobody finds out why. Logic that
 * fails quietly is logic that needs tests, and tests need it out of a JSX file.
 */

/** A post URL → something embeddable, or null if we do not recognise it. */
export function toEmbed(url) {
  const raw = String(url ?? "");

  // YouTube: watch, youtu.be, shorts and embed all resolve to one player.
  const yt = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (yt) {
    return {
      kind: "youtube",
      // nocookie: nothing tracks a visitor who never presses play.
      src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`,
      poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
      portrait: /shorts\//.test(raw),
    };
  }

  // Instagram reels and posts.
  const ig = raw.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  if (ig) {
    return {
      kind: "instagram",
      src: `https://www.instagram.com/p/${ig[1]}/embed/captioned/`,
      // Instagram serves no thumbnail without an API token, so the placeholder
      // is drawn rather than fetched.
      poster: null,
      // Reels are vertical. Treating one as landscape crops the subject out.
      portrait: true,
    };
  }

  return null;
}

/** The videos for a trip, or the general ones when no slug is given. */
export function videosFor(tripSlug) {
  return VIDEOS.filter((video) => (tripSlug ? video.trip === tripSlug : !video.trip));
}
