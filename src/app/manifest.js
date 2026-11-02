import { SITE_NAME, ORG_LEGAL_NAME } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Web app manifest.
 *
 * `/manifest.webmanifest` was 404ing, so Android offered no "add to home
 * screen" and the installed icon fell back to a screenshot of the page. For a
 * travel site in India — where a large share of visits are a returning
 * customer checking their trip on a mid-range Android — a home-screen icon is
 * a cheap retention win.
 *
 * Colours match the `themeColor` in the root layout's viewport export so the
 * address bar and the splash screen agree with each other.
 */
export default function manifest() {
  return {
    name: `${SITE_NAME} — ${ORG_LEGAL_NAME}`,
    short_name: SITE_NAME,
    description:
      "Fixed-departure group tours, customized private trips, and a corporate travel desk.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ee",
    theme_color: "#f5f3ee",
    lang: "en-IN",
    categories: ["travel", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
