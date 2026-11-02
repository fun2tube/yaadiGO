"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts from 0 to `value` once the element scrolls into view.
 *
 * Renders the final value as the initial server HTML so the number is correct
 * without JS and correct for crawlers — the animation only ever replaces a
 * already-correct value, never a zero.
 */
export default function CountUp({ value, duration = 1400, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        const start = performance.now();
        let frame;

        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          // easeOutExpo — fast out of the gate, long settle. Reads as
          // "counting up" rather than "linearly incrementing".
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setDisplay(Math.round(eased * value));
          if (t < 1) frame = requestAnimationFrame(tick);
        };

        setDisplay(0);
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}
