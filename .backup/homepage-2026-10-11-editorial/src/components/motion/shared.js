"use client";

import { useState, useSyncExternalStore } from "react";
import { transform, useTransform } from "motion/react";

const noopSubscribe = () => () => {};

/** The house ease, shared with `--ease-out-soft` in globals.css. */
export const EASE_OUT_SOFT = [0.16, 1, 0.3, 1];

/**
 * False on the server and on the first client render, true after hydration.
 *
 * Scroll-linked styles are computed at scroll position zero, so anything that
 * starts hidden would be written as `opacity:0` into the server HTML — and
 * stay invisible with JS blocked (see docs/design/motion.md, rule 0). Gate
 * hidden-at-rest styles on this and the server markup stays fully readable.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

const FINE = "(hover: hover) and (pointer: fine)";

/**
 * True on a device with a real pointer that can hover — the only place
 * magnetic buttons and tilt make sense. On touch they would fire on tap and
 * leave the element stuck mid-transform.
 */
export function useFinePointer() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(FINE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(FINE).matches,
    () => false
  );
}

/**
 * `useTransform(value, input, output)`, but always computed in JS.
 *
 * motion hands a plain range-mapped scroll value on `opacity` or
 * `clip-path` to the browser's native ScrollTimeline. Those offsets are
 * captured once — so when a pinned section ABOVE measures itself after mount
 * and grows the page by a few thousand pixels, every accelerated opacity
 * below it fires at the wrong scroll position. A function transformer opts
 * out of acceleration and is re-evaluated against live offsets.
 */
export function useLiveTransform(value, input, output) {
  const [map] = useState(() => transform(input, output));
  return useTransform(value, (v) => map(v));
}
