"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const EditModeContext = createContext(null);

export function useEditMode() {
  return useContext(EditModeContext) ?? { active: false, selected: null };
}

/**
 * Edit mode.
 *
 * When on, every element carrying `data-cms-id` becomes selectable. The
 * outline and the click handling are done with ONE delegated listener on the
 * document and a single CSS rule, rather than by re-rendering the page with
 * editing props — which means edit mode costs nothing when off and cannot
 * change how the page renders when on. What you are editing is the real page,
 * not a preview of it.
 */
export default function EditModeProvider({ children, storage }) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState(null);
  const pathname = usePathname();

  // Selection belongs to a page; keeping it across a navigation would point
  // the inspector at an element that is no longer on screen.
  //
  // Adjusted during render rather than in an effect — React's documented
  // pattern for "reset state when a prop changes". An effect would render
  // once with a stale selection before clearing it.
  const [selectionPath, setSelectionPath] = useState(pathname);
  if (selectionPath !== pathname) {
    setSelectionPath(pathname);
    setSelected(null);
  }

  useEffect(() => {
    document.documentElement.toggleAttribute("data-cms-editing", active);
    return () => document.documentElement.removeAttribute("data-cms-editing");
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const onClick = (event) => {
      const target = event.target.closest("[data-cms-id]");
      if (!target) return;
      // Editing takes precedence over whatever the element normally does —
      // otherwise clicking a heading inside a card navigates away.
      event.preventDefault();
      event.stopPropagation();
      setSelected({
        id: target.getAttribute("data-cms-id"),
        kind: target.getAttribute("data-cms-kind") ?? "text",
        tag: target.tagName.toLowerCase(),
        // A heading that renders markup from its text (EditorialHeading's
        // *italic* words) carries the raw source, so editing it never
        // silently drops the emphasis.
        visibleText: (target.getAttribute("data-cms-source") ?? target.textContent ?? "")
          .trim()
          .slice(0, 2000),
      });
    };

    const onKey = (event) => {
      if (event.key === "Escape") setSelected(null);
    };

    // Capture phase so links and buttons never get the click first.
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  const value = useMemo(
    () => ({
      active,
      setActive,
      selected,
      setSelected,
      storage,
      pathname,
      // After a successful write the server has new HTML; a reload is the
      // honest way to show exactly what a visitor will get.
      refresh: () => window.location.reload(),
    }),
    [active, selected, storage, pathname]
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

/** Highlighting, injected once. Scoped to the editing attribute on <html>. */
export function EditModeStyles() {
  return (
    <style>{`
      html[data-cms-editing] [data-cms-id] {
        outline: 1px dashed rgb(180 81 47 / 0.55);
        outline-offset: 3px;
        cursor: pointer;
        border-radius: 3px;
        transition: outline-color .15s, background-color .15s;
      }
      html[data-cms-editing] [data-cms-id]:hover {
        outline: 2px solid var(--color-accent);
        background-color: rgb(180 81 47 / 0.07);
      }
      html[data-cms-editing] [data-cms-selected] {
        outline: 2px solid var(--color-accent);
        background-color: rgb(180 81 47 / 0.12);
      }
      @media (prefers-reduced-motion: reduce) {
        html[data-cms-editing] [data-cms-id] { transition: none; }
      }
    `}</style>
  );
}

/** Keeps the selected element visually marked without re-rendering the tree. */
export function useSelectionOutline(selectedId) {
  const mark = useCallback(() => {
    document
      .querySelectorAll("[data-cms-selected]")
      .forEach((el) => el.removeAttribute("data-cms-selected"));
    if (!selectedId) return;
    document
      .querySelector(`[data-cms-id="${CSS.escape(selectedId)}"]`)
      ?.setAttribute("data-cms-selected", "");
  }, [selectedId]);

  useEffect(() => {
    mark();
  }, [mark]);
}
