/**
 * The design controls an editor is allowed to change.
 *
 * Deliberately a fixed menu of tokens rather than free CSS. Letting anyone
 * type arbitrary colour and size values is how a site drifts into forty
 * greys and nine type sizes within a month — and it would also mean
 * injecting untrusted style strings into the page.
 *
 * Every option maps to a class already in the design system, so an edit can
 * make a page different but cannot make it inconsistent.
 *
 * Shared by the inspector UI, the AI agent's tool schema and the renderer,
 * so all three can never disagree about what is permitted.
 */

export const STYLE_GROUPS = [
  {
    key: "size",
    label: "Size",
    options: [
      { value: "xs", label: "XS" },
      { value: "sm", label: "S" },
      { value: "base", label: "M" },
      { value: "lg", label: "L" },
      { value: "xl", label: "XL" },
      { value: "2xl", label: "2XL" },
      { value: "3xl", label: "3XL" },
    ],
  },
  {
    key: "weight",
    label: "Weight",
    options: [
      { value: "normal", label: "Regular" },
      { value: "medium", label: "Medium" },
      { value: "semibold", label: "Semibold" },
      { value: "bold", label: "Bold" },
      { value: "black", label: "Black" },
    ],
  },
  {
    key: "colour",
    label: "Colour",
    options: [
      { value: "default", label: "Default" },
      { value: "muted", label: "Muted" },
      { value: "faint", label: "Faint" },
      { value: "accent", label: "Accent" },
      { value: "onDark", label: "On dark" },
      { value: "onDarkMuted", label: "On dark, muted" },
      { value: "warn", label: "Warning" },
    ],
  },
  {
    key: "font",
    label: "Typeface",
    options: [
      { value: "display", label: "Display" },
      { value: "body", label: "Body" },
      { value: "mono", label: "Mono" },
    ],
  },
  {
    key: "align",
    label: "Align",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Centre" },
      { value: "right", label: "Right" },
    ],
  },
];

/**
 * Token -> class. Written out in full rather than built by template string,
 * because Tailwind scans source text for class names and would strip any
 * class it cannot see literally.
 */
export const STYLE_CLASSES = {
  size: {
    xs: "!text-[11px]",
    sm: "!text-[13px]",
    base: "!text-[15px]",
    lg: "!text-[19px]",
    xl: "!text-[24px]",
    "2xl": "!text-[32px]",
    "3xl": "!text-[44px]",
  },
  weight: {
    normal: "!font-normal",
    medium: "!font-medium",
    semibold: "!font-semibold",
    bold: "!font-bold",
    black: "!font-black",
  },
  colour: {
    default: "!text-paper-text",
    muted: "!text-paper-text-muted",
    faint: "!text-paper-text-faint",
    accent: "!text-accent-deep",
    onDark: "!text-ink-text",
    onDarkMuted: "!text-ink-text-muted",
    warn: "!text-warn",
  },
  font: {
    display: "!font-display",
    body: "!font-body",
    mono: "!font-mono",
  },
  align: {
    left: "!text-left",
    center: "!text-center",
    right: "!text-right",
  },
};

/** Strips anything not in the menu. Used on every write path. */
export function sanitiseStyle(style) {
  if (!style || typeof style !== "object") return null;
  const clean = {};
  for (const group of STYLE_GROUPS) {
    const value = style[group.key];
    if (value && group.options.some((option) => option.value === value)) {
      clean[group.key] = value;
    }
  }
  return Object.keys(clean).length ? clean : null;
}
