"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Inertial scrolling for the page it is mounted on — the weight under every
 * other scroll-linked motion. Without it a wheel moves the page in 100px
 * jumps and every parallax layer jumps with it; with it, the page glides and
 * the layered motion reads as one continuous camera move.
 *
 * Desktop with a mouse or trackpad only. On touch the platform's own momentum
 * is already right and anything layered on it feels wrong, so `syncTouch`
 * stays off and the component does nothing on a coarse pointer. Nothing under
 * reduced motion either.
 *
 * `allowNestedScroll` lets the concierge panel, menus and any overflow box
 * scroll natively instead of the wheel being captured by the page.
 */
export default function SmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.085,
      wheelMultiplier: 0.95,
      anchors: true,
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
    });

    return () => lenis.destroy();
  }, []);

  return null;
}
