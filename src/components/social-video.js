import { toEmbed, videosFor } from "@/lib/video";

/**
 * Video on the site, from the social posts that already exist.
 *
 * The content plan's rule is "produce once, publish three places" — the trips
 * are already being filmed for Instagram and YouTube, and asking the desk to
 * export a second copy for the website is the step that never happens. So the
 * site plays the post.
 *
 * **Nothing loads until the visitor asks.** An embedded Instagram or YouTube
 * player is several hundred kilobytes of third-party JavaScript and a set of
 * tracking cookies, and a page with four of them is unusable on a mid-range
 * Android. Each one here is a poster and a play button until it is tapped;
 * only then does the iframe exist. That keeps the performance budget — and
 * means a visitor who never plays a video is never tracked by Meta or Google
 * on our behalf.
 *
 * Vertical by default, because Reels and Shorts are the format this audience
 * actually watches and a letterboxed landscape video in a 9:16 slot looks
 * broken.
 */

export default function SocialVideo({ tripSlug, heading = "On the trip", limit = 4 }) {
  const videos = videosFor(tripSlug)
    .map((video) => ({ ...video, embed: toEmbed(video.url) }))
    // A link we cannot embed is dropped rather than rendered as a broken
    // frame — the section simply does not appear.
    .filter((video) => video.embed)
    .slice(0, limit);

  if (videos.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
      <h2 className="font-display text-[24px] font-black tracking-tight text-paper-text sm:text-[30px]">
        {heading}
      </h2>
      <p className="mt-1 text-[13.5px] text-paper-text-muted">
        Filmed on our own departures — not stock footage.
      </p>

      <div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((video) => (
          <LazyVideo key={video.url} video={video} />
        ))}
      </div>
    </section>
  );
}

/**
 * One video, loaded on demand.
 *
 * A `<details>` element rather than React state, deliberately: it is the only
 * way to get click-to-load with **no client JavaScript at all**, so this works
 * on a page that has not hydrated and adds nothing to the bundle.
 */
function LazyVideo({ video }) {
  const { embed, title } = video;

  return (
    <details className="group w-[78vw] max-w-[300px] shrink-0 snap-start sm:w-[280px]">
      <summary className="relative block cursor-pointer list-none overflow-hidden rounded-2xl border border-paper-line bg-ink [&::-webkit-details-marker]:hidden">
        <div className={embed.portrait ? "aspect-[9/16]" : "aspect-video"}>
          {embed.poster ? (
            // A remote thumbnail from YouTube's CDN; next/image would need
            // that domain whitelisted for no benefit on a lazy poster.
            // The directive has to be the LAST comment line before the tag —
            // "next line" means the next line, and two lines of prose sat
            // between the two, so this rule was never actually suppressed.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={embed.poster}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-80 transition-opacity group-open:hidden"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-ink-soft group-open:hidden">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-text-faint">
                {embed.kind}
              </span>
            </div>
          )}

          <span className="absolute inset-0 flex items-center justify-center group-open:hidden">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="#1a1917" />
              </svg>
            </span>
          </span>
        </div>

        {title ? (
          <span className="block px-3 py-2.5 text-[13px] font-semibold text-ink-text group-open:hidden">
            {title}
          </span>
        ) : null}
      </summary>

      {/* Only now does the third-party player exist. */}
      <div className={`overflow-hidden rounded-2xl ${embed.portrait ? "aspect-[9/16]" : "aspect-video"}`}>
        <iframe
          src={embed.src}
          title={title ?? "Video"}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </details>
  );
}
