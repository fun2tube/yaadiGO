import { getOverrides } from "@/lib/cms/store";
import { STYLE_CLASSES } from "@/lib/cms/style-tokens";

/**
 * A light serif heading whose words rise out of their own masks, with
 * `*asterisks*` marking the words set in italic:
 *
 *   <EditorialHeading id="home.ways.heading" text="Join a group, *or make it your own.*" />
 *
 * It is <Editable> and <SplitHeading> in one: it honours the same override
 * store (text, hidden, style) and writes the same two data-cms attributes, so
 * the page editor selects and edits it exactly as before. An editor can type
 * asterisks too — the emphasis is part of the content, not the code.
 *
 * `play="load"` animates straight from the server HTML (the hero);
 * `play="scroll"` waits for the shared Reveal observer.
 */
export default async function EditorialHeading({
  id,
  text,
  as: Tag = "h2",
  className = "",
  play = "scroll",
  delay = 0,
}) {
  const overrides = await getOverrides();
  if (id && overrides.hidden[id]) return null;

  const source = String((id && overrides.text[id]) ?? text);
  const style = id ? overrides.style[id] : null;
  const styleClass = style
    ? Object.entries(style)
        .map(([group, value]) => STYLE_CLASSES[group]?.[value] ?? "")
        .filter(Boolean)
        .join(" ")
    : "";

  // "Join a group, *or make it your own.*" → [{ word, em }]
  let em = false;
  const words = [];
  for (const raw of source.split(/\s+/).filter(Boolean)) {
    let word = raw;
    const opens = word.startsWith("*");
    if (opens) {
      em = true;
      word = word.slice(1);
    }
    const closes = word.endsWith("*");
    if (closes) word = word.slice(0, -1);
    if (word) words.push({ word, em });
    if (closes) em = false;
  }
  const plain = words.map((w) => w.word).join(" ");

  return (
    <Tag
      aria-label={plain}
      className={`${className} ${styleClass}`.trim()}
      {...(id ? { "data-cms-id": id, "data-cms-kind": "text", "data-cms-source": source } : {})}
      {...(play === "scroll"
        ? { "data-reveal": "words", style: delay ? { "--reveal-delay": `${delay}ms` } : undefined }
        : {})}
    >
      {words.map(({ word, em: italic }, i) => (
        <span key={i} aria-hidden="true">
          <span className={`word-mask ${play === "load" ? "is-hero" : ""}`}>
            <span style={{ "--w": i }} className={italic ? "display-italic" : undefined}>
              {word}
            </span>
          </span>{" "}
        </span>
      ))}
    </Tag>
  );
}
