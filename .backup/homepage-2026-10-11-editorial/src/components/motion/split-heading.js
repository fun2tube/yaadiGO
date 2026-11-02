/**
 * A heading whose words rise one by one out of their own masks.
 *
 * CSS-driven (`.word-mask` in globals.css), so it animates straight from the
 * server HTML with no hydration wait and still plays with JavaScript blocked.
 * Works in server and client components alike — it holds no state.
 *
 * `cmsId` keeps the heading selectable in the page editor, the same two
 * attributes <Editable> writes. The aria-label keeps it one phrase for screen
 * readers rather than a list of separate words.
 */
export default function SplitHeading({ as: Tag = "h1", text, className = "", cmsId, delay = 0 }) {
  return (
    <Tag
      aria-label={text}
      className={className}
      {...(cmsId ? { "data-cms-id": cmsId, "data-cms-kind": "text" } : {})}
    >
      {String(text)
        .split(" ")
        .map((word, i) => (
          <span key={i} aria-hidden="true">
            <span className="word-mask">
              <span style={{ "--w": i + delay }}>{word}</span>
            </span>{" "}
          </span>
        ))}
    </Tag>
  );
}
