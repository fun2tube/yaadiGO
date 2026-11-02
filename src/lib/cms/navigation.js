import "server-only";

import { cache } from "react";

import { listRecords, upsertBy } from "@/lib/cms/records";

/**
 * The site menu.
 *
 * Same rule as every other editable thing here: **nothing saved means exactly
 * the menu that is in the code.** The array below is the real navigation and
 * stays reviewable in git; saving one in the admin overrides it, and deleting
 * that record puts the coded one back.
 *
 * The menu is site-wide, not per-page, which is why it is edited on its own
 * screen rather than dragged onto a canvas. Dropping a "nav block" onto the
 * homepage would mean every other page either has no menu or has a different
 * one — which is how builder-made sites end up with three navigations.
 */

export const NAVIGATION = "navigation";

/** The coded default. Mirrors NAV_LINKS in site-nav-client.js. */
// Leisure products only, one name each (docs/design/homepage-content-
// strategy.md). Corporate is a separate audience: it is linked as "For
// business" on the right of the bar and in the footer, not listed here.
export const DEFAULT_LINKS = [
  { href: "/group-tours", label: "Group Tours", mega: true },
  { href: "/customized-tours", label: "Customized Tours" },
  { href: "/plan", label: "AI Planner" },
  { href: "/blog", label: "Journal" },
];

/** Extra entries the phone menu shows below the main ones. */
export const DEFAULT_MOBILE_EXTRA = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];


/** The coded footer columns. Mirrors COLUMNS in site-footer.js. */
export const DEFAULT_FOOTER = [
  {
    title: "Travel",
    links: [
      { href: "/group-tours", label: "Group Tours" },
      { href: "/customized-tours", label: "Customized Tours" },
      { href: "/plan", label: "AI Trip Planner" },
    ],
  },
  {
    title: "Business",
    links: [{ href: "/corporate-travel", label: "Corporate Travel" }],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Journal" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

/**
 * The numbered index ("01", "02") is DERIVED from position, never stored.
 * Storing it means an editor reorders the menu and the numbers stay where they
 * were — the one bug this numbering style invites.
 */
function numbered(links) {
  return links.map((link, i) => ({
    ...link,
    index: String(i + 1).padStart(2, "0"),
  }));
}

export const getNavigation = cache(async function getNavigation() {
  const rows = await listRecords(NAVIGATION);
  const saved = rows.find((row) => row.key === "main");

  const main = Array.isArray(saved?.links) && saved.links.length > 0 ? saved.links : DEFAULT_LINKS;
  const extra = Array.isArray(saved?.mobileExtra) ? saved.mobileExtra : DEFAULT_MOBILE_EXTRA;

  const footer =
    Array.isArray(saved?.footer) && saved.footer.length > 0 ? saved.footer : DEFAULT_FOOTER;

  return {
    links: numbered(main),
    mobileLinks: numbered([...main, ...extra]),
    // Columns are numbered the same way and for the same reason.
    footer: footer.map((column, i) => ({
      ...column,
      index: String(i + 1).padStart(2, "0"),
    })),
    // So the admin screen can say whether it is showing the coded menu.
    edited: Boolean(saved?.links?.length),
    footerEdited: Boolean(saved?.footer?.length),
  };
});

export async function saveNavigation({ links, mobileExtra, footer }, { actor } = {}) {
  return upsertBy(NAVIGATION, "key", "main", {
    key: "main",
    links,
    mobileExtra,
    // Only written when supplied, so saving the menu does not silently reset
    // the footer and vice versa — they are edited on the same screen but are
    // independent records.
    ...(footer === undefined ? {} : { footer }),
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.name ?? null,
  });
}

/** Back to the coded menu. */
export async function resetNavigation({ actor } = {}) {
  return upsertBy(NAVIGATION, "key", "main", {
    key: "main",
    links: null,
    mobileExtra: null,
    footer: null,
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.name ?? null,
  });
}
