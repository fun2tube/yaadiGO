"use client";

import { useEffect, useState } from "react";
import { LazyMotion, domAnimation, m, useMotionValue, useSpring } from "motion/react";

/**
 * A disc that follows the pointer and names what a click will do — "View",
 * "Explore", "Read" — but only over elements that ask for it with
 * `data-cursor="View"`. Everywhere else it is not there at all.
 *
 * The native cursor is never hidden. A replacement cursor is the usual way
 * this effect is built and the usual way it goes wrong: it lags a frame
 * behind the hand, it vanishes over iframes, and it breaks text selection.
 * This adds a label beside the real one instead of replacing it.
 *
 * Mouse and trackpad only, and nothing under reduced motion.
 */
export default function CursorLabel() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("");
  const [visible, setVisible] = useState(false);
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const sx = useSpring(x, { stiffness: 380, damping: 34, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 380, damping: 34, mass: 0.5 });

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    // Deferred so the first render (server and client alike) has no disc.
    const ready = requestAnimationFrame(() => setEnabled(true));

    let current = null;
    const onMove = (event) => {
      x.set(event.clientX);
      y.set(event.clientY);
      const target = event.target instanceof Element ? event.target.closest("[data-cursor]") : null;
      const next = target?.getAttribute("data-cursor") || null;
      if (next !== current) {
        current = next;
        // The text is kept while the disc shrinks away, so it never empties
        // mid-animation.
        if (next) setLabel(next);
        setVisible(Boolean(next));
      }
    };
    const onLeave = () => {
      current = null;
      setVisible(false);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(ready);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[90]"
        style={{ x: sx, y: sy }}
      >
        <m.div
          className="flex h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-paper text-ink"
          initial={false}
          animate={visible ? { scale: 1, opacity: 1 } : { scale: 0.2, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow text-[10.5px] text-ink">{label}</span>
        </m.div>
      </m.div>
    </LazyMotion>
  );
}
