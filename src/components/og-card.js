import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The shared share-card layout, used by every `opengraph-image` route.
 *
 * Why this exists: `generateMetadata` returning an `openGraph` object REPLACES
 * the one inherited from the root layout rather than merging into it, so every
 * page that set its own og:title silently lost the site-wide og:image. Trip
 * pages and blog posts — the two things anyone actually forwards — were being
 * shared as a grey box with no picture.
 *
 * A file-based `opengraph-image.js` inside the route segment fixes that for
 * good: Next gives the more specific image precedence over anything above it
 * in the folder tree, and it cannot be clobbered by a metadata object.
 *
 * Built from type, not photography. Real trip photographs would be better and
 * are the right long-term answer (backlog #91), but a typeset card with the
 * actual trip name, length and price is honest, legible at WhatsApp's preview
 * size, and needs no asset pipeline. Nothing here is invented: every value is
 * passed in from the same data the page itself renders.
 *
 * Satori (which rasterises these) supports a subset of CSS — flexbox only, no
 * `gap` shorthand surprises, and every element holding more than one child
 * needs an explicit `display: flex`. Keep changes conservative.
 */

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Shared `ImageResponse` options for every share card.
 *
 * These routes render on demand — the build reports them as dynamic, because
 * their parent pages are — so a PNG is rasterised per request. That is cheap
 * but not free, and WhatsApp, Slack, Twitter and every crawler will each fetch
 * it. The CDN holds it for a day and may serve a stale copy for a week while
 * it refreshes behind the scenes; a share card one deploy out of date is not a
 * problem worth a cache miss.
 */
export const OG_RESPONSE = {
  ...OG_SIZE,
  headers: {
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  },
};

const PAPER = "#F6F4EE";
const INK = "#10141C";
const ACCENT = "#E8963D";
const MUTED = "#9BA3B0";
const FAINT = "#6E7686";

// The owner's logo (components/brand-logo.js), inlined: Satori needs the bytes,
// not a URL it would have to fetch from this same server mid-render.
const LOGO = `data:image/png;base64,${readFileSync(
  path.join(process.cwd(), "public/brand/yaadigo-logo.png")
).toString("base64")}`;

/**
 * The logo on a white tile: its dark green wordmark disappears on the ink
 * background, the same reason the corporate header backs it in white.
 */
export function OgLogo({ height = 84 }) {
  return (
    <div
      style={{
        display: "flex",
        background: "#FFFFFF",
        borderRadius: 16,
        padding: "10px 16px",
      }}
    >
      {/* Satori rasterises plain <img>; next/image means nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="" height={height} width={Math.round((height * 388) / 222)} />
    </div>
  );
}

export function OgCard({ eyebrow, title, meta = [], footnote }) {
  // Long trip names and blog headlines need different type sizes or they
  // either overflow the card or float in the middle of it looking unfinished.
  const size = title.length > 68 ? 50 : title.length > 42 ? 58 : 66;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: INK,
        padding: 72,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <OgLogo />
        {eyebrow ? (
          <div style={{ fontSize: 24, color: ACCENT, letterSpacing: 0.4 }}>{eyebrow}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: size,
            color: PAPER,
            lineHeight: 1.14,
            letterSpacing: -1.4,
            maxWidth: 980,
          }}
        >
          {title}
        </div>
        {meta.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {meta.map((item, i) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {i > 0 ? (
                  <div
                    style={{ width: 6, height: 6, borderRadius: 3, background: FAINT }}
                  />
                ) : null}
                <div style={{ fontSize: 30, color: MUTED }}>{item}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 40, height: 4, background: ACCENT, borderRadius: 2 }} />
        <div style={{ fontSize: 24, color: FAINT }}>{footnote ?? "yaadigo.com"}</div>
      </div>
    </div>
  );
}
