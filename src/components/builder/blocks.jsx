import Link from "next/link";
import Img from "@/components/img";
import ImageField from "./image-field";
import {
  PADDING,
  WIDTH,
  HEADING_SIZE,
  BODY_SIZE,
  BUTTON_SIZE,
  TONE,
  ALIGN,
  token,
  optionsOf,
} from "@/lib/cms/blocks";

/**
 * The blocks the page builder can place.
 *
 * Each one is an ordinary React component plus a `fields` description that
 * Puck turns into the editing panel. Two rules hold this together:
 *
 *   1. **Every size is a step, never a number.** `fields` offers select
 *      options drawn from the token maps in lib/cms/blocks.js, so there is no
 *      combination an editor can choose that breaks at 360px. This is the whole
 *      reason the builder cannot make the site worse.
 *
 *   2. **No block positions itself.** Blocks stack; the page is a column. A
 *      block never knows or cares what is above it, which is what makes drag
 *      reordering safe.
 *
 * These render on the server for visitors and inside Puck for the admin, from
 * the same definition — so what the editor shows is what ships.
 */

function Section({ tone, padding, width, align, children, className = "" }) {
  return (
    <section className={`${token(TONE, tone, "paper")} ${className}`}>
      <div
        className={`mx-auto flex w-full flex-col px-6 sm:px-10 ${token(
          PADDING,
          padding,
          "normal"
        )} ${token(WIDTH, width, "wide")} ${token(ALIGN, align, "left")}`}
      >
        {children}
      </div>
    </section>
  );
}

/** Shared controls every section gets, so the panel reads the same everywhere. */
const LAYOUT_FIELDS = {
  tone: { type: "select", label: "Background", options: optionsOf(TONE) },
  padding: { type: "select", label: "Spacing", options: optionsOf(PADDING) },
  width: { type: "select", label: "Content width", options: optionsOf(WIDTH) },
  align: { type: "select", label: "Alignment", options: optionsOf(ALIGN) },
};

const LAYOUT_DEFAULTS = { tone: "paper", padding: "normal", width: "wide", align: "left" };

export const Heading = {
  label: "Heading",
  fields: {
    text: { type: "textarea", label: "Text" },
    eyebrow: { type: "text", label: "Eyebrow (small label above)" },
    size: { type: "select", label: "Size", options: optionsOf(HEADING_SIZE) },
    ...LAYOUT_FIELDS,
  },
  defaultProps: {
    text: "A heading",
    eyebrow: "",
    size: "medium",
    ...LAYOUT_DEFAULTS,
  },
  render: ({ text, eyebrow, size, tone, padding, width, align }) => (
    <Section tone={tone} padding={padding} width={width} align={align}>
      {eyebrow ? (
        <span className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.13em] text-accent-deep">
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={`font-display font-black leading-[1.08] tracking-tight ${token(
          HEADING_SIZE,
          size,
          "medium"
        )}`}
      >
        {text}
      </h2>
    </Section>
  ),
};

export const Text = {
  label: "Paragraph",
  fields: {
    text: { type: "textarea", label: "Text" },
    size: { type: "select", label: "Size", options: optionsOf(BODY_SIZE) },
    ...LAYOUT_FIELDS,
  },
  defaultProps: {
    text: "Some words about the trip.",
    size: "normal",
    ...LAYOUT_DEFAULTS,
    width: "normal",
  },
  render: ({ text, size, tone, padding, width, align }) => (
    <Section tone={tone} padding={padding} width={width} align={align}>
      {/* whitespace-pre-line so a line break typed in the editor is a line
          break on the page — otherwise an editor types one and nothing
          happens, which reads as the field being broken. */}
      <p className={`whitespace-pre-line leading-relaxed opacity-80 ${token(BODY_SIZE, size, "normal")}`}>
        {text}
      </p>
    </Section>
  ),
};

export const Buttons = {
  label: "Buttons",
  fields: {
    items: {
      type: "array",
      label: "Buttons",
      arrayFields: {
        label: { type: "text", label: "Label" },
        href: { type: "text", label: "Link" },
        style: {
          type: "select",
          label: "Style",
          options: [
            { label: "Primary", value: "primary" },
            { label: "Outline", value: "outline" },
            { label: "WhatsApp", value: "whatsapp" },
          ],
        },
      },
      defaultItemProps: { label: "Plan my trip", href: "/plan", style: "primary" },
    },
    size: { type: "select", label: "Size", options: optionsOf(BUTTON_SIZE) },
    ...LAYOUT_FIELDS,
  },
  defaultProps: {
    items: [{ label: "Plan my trip with AI", href: "/plan", style: "primary" }],
    size: "normal",
    ...LAYOUT_DEFAULTS,
  },
  render: ({ items, size, tone, padding, width, align }) => {
    const base = `inline-flex items-center justify-center gap-2 rounded-full font-bold transition-transform active:scale-[0.98] ${token(
      BUTTON_SIZE,
      size,
      "normal"
    )}`;
    const styles = {
      primary: "bg-accent text-white shadow-lg shadow-accent/25",
      outline: "border border-current",
      whatsapp: "bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25",
    };
    return (
      <Section tone={tone} padding={padding} width={width} align={align}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          {(items ?? []).map((item, i) => (
            <Link key={i} href={item.href || "#"} className={`${base} ${styles[item.style] ?? styles.primary}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </Section>
    );
  },
};

export const Cards = {
  label: "Cards",
  fields: {
    heading: { type: "text", label: "Heading" },
    items: {
      type: "array",
      label: "Cards",
      arrayFields: {
        title: { type: "text", label: "Title" },
        detail: { type: "textarea", label: "Detail" },
      },
      defaultItemProps: { title: "A promise", detail: "What it means in practice." },
    },
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "Two", value: "2" },
        { label: "Three", value: "3" },
        { label: "Four", value: "4" },
      ],
    },
    ...LAYOUT_FIELDS,
  },
  defaultProps: {
    heading: "",
    items: [
      { title: "The seat counts are real", detail: "When it says two, it is two." },
      { title: "Written before you pay", detail: "Weather risk and permits, up front." },
    ],
    columns: "2",
    ...LAYOUT_DEFAULTS,
  },
  render: ({ heading, items, columns, tone, padding, width, align }) => {
    // Always one column on a phone, whatever the desktop setting. The editor
    // chooses the wide layout; the narrow one is not up for negotiation.
    const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };
    return (
      <Section tone={tone} padding={padding} width={width} align={align}>
        {heading ? (
          <h2 className="mb-6 font-display text-[24px] font-black tracking-tight sm:text-[32px]">
            {heading}
          </h2>
        ) : null}
        <div className={`grid w-full gap-3 ${cols[columns] ?? cols[2]}`}>
          {(items ?? []).map((item, i) => (
            <div key={i} className="rounded-2xl border border-current/10 bg-current/[0.03] p-5">
              <h3 className="text-[14.5px] font-bold">{item.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed opacity-75">{item.detail}</p>
            </div>
          ))}
        </div>
      </Section>
    );
  },
};

export const Picture = {
  label: "Image",
  fields: {
    // A visual picker, not a slug box. Alt text, dimensions and licence credit
    // travel with the choice because the library holds them against the id.
    imageId: {
      type: "custom",
      label: "Photo",
      render: ({ value, onChange }) => <ImageField value={value} onChange={onChange} />,
    },
    caption: { type: "text", label: "Caption" },
    shape: {
      type: "select",
      label: "Shape",
      options: [
        { label: "Inset", value: "inset" },
        { label: "Full bleed", value: "full" },
      ],
    },
    ...LAYOUT_FIELDS,
  },
  defaultProps: {
    imageId: "site-hero-himalaya",
    caption: "",
    shape: "inset",
    ...LAYOUT_DEFAULTS,
  },
  render: ({ imageId, caption, shape, tone, padding, width, align }) => (
    <Section tone={tone} padding={padding} width={shape === "full" ? "full" : width} align={align}>
      <figure className="w-full">
        <div className={`relative w-full overflow-hidden ${shape === "full" ? "" : "rounded-2xl"}`}>
          {/* Alt text comes from the media library with the image, which is why
              this field takes an ID and not a URL. */}
          <Img id={imageId} sizes="100vw" className="h-auto w-full object-cover" />
        </div>
        {caption ? <figcaption className="mt-2 text-[12.5px] opacity-70">{caption}</figcaption> : null}
      </figure>
    </Section>
  ),
};

export const Spacer = {
  label: "Spacer",
  fields: {
    size: { type: "select", label: "Height", options: optionsOf(PADDING) },
    tone: { type: "select", label: "Background", options: optionsOf(TONE) },
  },
  defaultProps: { size: "normal", tone: "paper" },
  render: ({ size, tone }) => (
    <div className={`${token(TONE, tone, "paper")} ${token(PADDING, size, "normal")}`} />
  ),
};
