import { getOverrides } from "@/lib/cms/store";
import { STYLE_CLASSES } from "@/lib/cms/style-tokens";

/**
 * Marks a piece of content as editable.
 *
 * <Editable id="page.home.hero.heading" as="h1" className="...">
 *   Trips we plan, tours we run
 * </Editable>
 *
 * The child is the DEFAULT, living in code and reviewable in git. If an
 * override exists it wins; otherwise the default renders. So an empty content
 * store produces exactly the site you already had.
 *
 * WHY OPT-IN RATHER THAN "CLICK ANYTHING"
 *
 * It would be possible to make every DOM node clickable, but there would be
 * nothing stable to save the edit against — a node's position in the tree
 * changes the moment anyone touches the component, and yesterday's edit would
 * reattach to the wrong element or vanish. A declared id is a contract: it
 * survives refactors, it is greppable, and the agent can reason about it.
 *
 * The cost is that a field is editable only once someone has wrapped it. The
 * benefit is that edits are never silently lost.
 */
export default async function Editable({
  id,
  as: Tag = "span",
  className = "",
  children,
  multiline = false,
}) {
  const overrides = await getOverrides();

  if (overrides.hidden[id]) return null;

  const text = overrides.text[id] ?? null;
  const style = overrides.style[id] ?? null;

  const styleClass = style
    ? Object.entries(style)
        .map(([group, value]) => STYLE_CLASSES[group]?.[value] ?? "")
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <Tag
      // Edit mode finds editable nodes by this attribute alone, so nothing
      // about the visual tree has to be understood by the client.
      data-cms-id={id}
      data-cms-kind={multiline ? "multiline" : "text"}
      className={`${className} ${styleClass}`.trim()}
    >
      {text ?? children}
    </Tag>
  );
}
