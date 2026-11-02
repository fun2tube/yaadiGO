"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Turns a page into an Instagram-reel-style vertical swipe deck.
 *
 * The scroll container is the document itself, not a nested div. That matters:
 * a nested scroller breaks the sticky header, breaks browser scroll
 * restoration, breaks find-in-page scrolling, and on iOS breaks the
 * address-bar collapse. Setting `scroll-snap-type` on <html> keeps all of
 * that native and costs one attribute.
 *
 * Snapping is deliberately NOT applied when a panel is taller than the
 * viewport — with `mandatory`, content below the fold in an oversized panel
 * becomes unreachable. The CSS in globals.css handles that with a height
 * media query; this component handles the rest.
 */
export default function Reel({ panelCount }) {
  const [active, setActive] = useState(0);
  // The keyboard handler needs the current panel, but must not be a reason to
  // tear down and rebuild the observers on every swipe — so it reads a ref,
  // which the observer below writes alongside the state update.
  const activeRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-reel", "");

    const panels = Array.from(document.querySelectorAll("[data-panel]"));

    // Track which panel is centred, for the progress dots.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = panels.indexOf(entry.target);
            if (index !== -1) {
              activeRef.current = index;
              setActive(index);
            }
          }
        }
      },
      { threshold: 0.55 }
    );
    panels.forEach((panel) => observer.observe(panel));

    // Keyboard parity with the swipe gesture — arrows and PageUp/Down move a
    // whole panel, because native scrolling inside a snap container stops
    // between panels in a way that feels broken with a keyboard.
    const onKey = (event) => {
      const forward = event.key === "ArrowDown" || event.key === "PageDown";
      const back = event.key === "ArrowUp" || event.key === "PageUp";
      if (!forward && !back) return;
      if (event.target.closest("input, textarea, select, [contenteditable]")) return;

      const current = activeRef.current;
      const next = Math.min(Math.max(current + (forward ? 1 : -1), 0), panels.length - 1);
      if (next === current) return;
      event.preventDefault();
      panels[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    window.addEventListener("keydown", onKey);

    return () => {
      root.removeAttribute("data-reel");
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const count = panelCount ?? 0;

  return (
    <div
      aria-hidden="true"
      className="no-print pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 sm:flex"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`block w-1 rounded-full transition-all duration-300 ${
            i === active ? "h-6 bg-accent" : "h-1.5 bg-paper-text-faint/40"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * One full-height panel in the deck. `min-h` rather than a fixed height so a
 * panel that genuinely needs more room on a small phone grows instead of
 * clipping its own content.
 */
export function Panel({ children, className = "", tone = "paper", id }) {
  const tones = {
    paper: "bg-paper",
    dim: "bg-paper-dim",
    ink: "bg-ink",
  };

  return (
    <section
      id={id}
      data-panel
      className={`flex min-h-[100dvh] snap-start flex-col justify-center ${tones[tone]} ${className}`}
    >
      {children}
    </section>
  );
}
