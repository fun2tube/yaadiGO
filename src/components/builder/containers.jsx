import { PADDING, WIDTH, TONE, ALIGN, token, optionsOf } from "@/lib/cms/blocks";

/**
 * Containers — blocks you drop other blocks into.
 *
 * Until now the page was a flat stack: every block sat at the top level and
 * ran the full width. That is enough to prove a builder works and not enough
 * to rebuild a real page, where a heading and a paragraph share a tinted band
 * and two things sit side by side.
 *
 * Puck's `slot` field is the mechanism — a drop zone inside a component. The
 * value arrives as a component, so a slot is rendered by calling it.
 *
 * The responsive rule still holds and is enforced here rather than trusted:
 * **columns stack on a phone, always.** The editor chooses the wide layout; the
 * narrow one is not up for negotiation. There is no setting that produces two
 * columns at 360px, because there is no width at which that reads well on this
 * site.
 */

const LAYOUT_FIELDS = {
  tone: { type: "select", label: "Background", options: optionsOf(TONE) },
  padding: { type: "select", label: "Spacing", options: optionsOf(PADDING) },
  width: { type: "select", label: "Content width", options: optionsOf(WIDTH) },
};

export const Band = {
  label: "Band (group blocks)",
  fields: {
    content: { type: "slot" },
    align: { type: "select", label: "Alignment", options: optionsOf(ALIGN) },
    ...LAYOUT_FIELDS,
  },
  defaultProps: {
    align: "left",
    tone: "dim",
    padding: "normal",
    width: "wide",
  },
  render: ({ content: Content, tone, padding, width, align }) => (
    <section className={token(TONE, tone, "dim")}>
      <div
        className={`mx-auto flex w-full flex-col px-6 sm:px-10 ${token(
          PADDING,
          padding,
          "normal"
        )} ${token(WIDTH, width, "wide")} ${token(ALIGN, align, "left")}`}
      >
        {/* Blocks dropped in here inherit the band's background and spacing,
            so their own tone setting should be left on the default. */}
        <Content />
      </div>
    </section>
  ),
};

export const Columns = {
  label: "Columns",
  fields: {
    left: { type: "slot" },
    right: { type: "slot" },
    split: {
      type: "select",
      label: "Split (on desktop)",
      options: [
        { label: "Equal", value: "equal" },
        { label: "Wider left", value: "left" },
        { label: "Wider right", value: "right" },
      ],
    },
    ...LAYOUT_FIELDS,
  },
  defaultProps: {
    split: "equal",
    tone: "paper",
    padding: "normal",
    width: "wide",
  },
  render: ({ left: Left, right: Right, split, tone, padding, width }) => {
    // One column below `lg`, every time. A two-column layout at 360px is the
    // single most common way a builder-made page becomes unreadable on the
    // device most of this site's traffic uses.
    const grid = {
      equal: "lg:grid-cols-2",
      left: "lg:grid-cols-[1.6fr_1fr]",
      right: "lg:grid-cols-[1fr_1.6fr]",
    };

    return (
      <section className={token(TONE, tone, "paper")}>
        <div
          className={`mx-auto w-full px-6 sm:px-10 ${token(PADDING, padding, "normal")} ${token(
            WIDTH,
            width,
            "wide"
          )}`}
        >
          <div className={`grid gap-8 ${grid[split] ?? grid.equal}`}>
            <div className="min-w-0">
              <Left />
            </div>
            <div className="min-w-0">
              <Right />
            </div>
          </div>
        </div>
      </section>
    );
  },
};
