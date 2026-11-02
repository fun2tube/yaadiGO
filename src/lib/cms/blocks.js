/**
 * The size vocabulary the page builder is allowed to use.
 *
 * This is the decision that keeps a drag-and-drop editor from wrecking the
 * mobile site. A width dragged by hand is correct at exactly one viewport —
 * which is why builder-made pages are famously broken on phones, and why
 * Webflow makes you lay out every breakpoint separately.
 *
 * So the builder composes freely and sizes in STEPS. Every step is a
 * design-system token that already works from 360px up, which means there is
 * no combination of settings that produces a broken phone layout. The editor
 * cannot make the site worse, only different.
 *
 * Browser-safe on purpose: the Puck editor runs in the admin and needs these,
 * and so does the server renderer.
 */

/** Vertical breathing room around a section. */
export const PADDING = {
  tight: "py-8 sm:py-10",
  normal: "py-10 sm:py-14",
  roomy: "py-16 sm:py-24",
};

/** How wide the content runs before it stops. */
export const WIDTH = {
  narrow: "max-w-2xl",
  normal: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

/** Heading scale. Three steps, because four invites a wrong one. */
export const HEADING_SIZE = {
  small: "text-[22px] sm:text-[28px]",
  medium: "text-[28px] sm:text-[38px]",
  large: "text-[32px] sm:text-[48px]",
  hero: "text-[38px] sm:text-[64px]",
};

export const BODY_SIZE = {
  small: "text-[13.5px]",
  normal: "text-[15px]",
  large: "text-[17px] sm:text-[19px]",
};

export const BUTTON_SIZE = {
  small: "px-4 py-2.5 text-[13.5px]",
  normal: "px-6 py-3.5 text-[15px]",
  large: "px-8 py-4 text-[16px]",
};

/**
 * Section background. Named for what it means, not what colour it is, so the
 * palette can change without every page needing re-editing.
 */
export const TONE = {
  paper: "bg-paper text-paper-text",
  dim: "bg-paper-dim text-paper-text",
  ink: "bg-ink text-ink-text",
  card: "bg-card text-paper-text",
};

export const ALIGN = {
  left: "text-left items-start",
  centre: "text-center items-center mx-auto",
};

/** Turn a step name into classes, falling back to the middle option. */
export function token(map, value, fallback) {
  return map[value] ?? map[fallback] ?? Object.values(map)[0];
}

/** The options a Puck select field offers, derived so the two cannot drift. */
export function optionsOf(map) {
  return Object.keys(map).map((value) => ({
    label: value[0].toUpperCase() + value.slice(1),
    value,
  }));
}
