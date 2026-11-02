"use client";

import { useEffect } from "react";

/**
 * Drives every `[data-reveal]` element on the page with ONE IntersectionObserver
 * rather than one per component, and unobserves each element after it fires —
 * so a long page with 60 revealing elements costs one observer and 60 one-shot
 * callbacks, not 60 scroll listeners.
 *
 * The animation itself lives in globals.css. This component only flips the
 * `data-revealed` attribute, which means React never re-renders to animate.
 */
export default function Reveal() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function show(el) {
      el.setAttribute("data-revealed", "");
      // Drop the compositor hint once the transition has run; leaving
      // will-change on dozens of elements keeps layers alive for nothing.
      const clear = () => {
        el.style.willChange = "auto";
        el.removeEventListener("transitionend", clear);
      };
      el.addEventListener("transitionend", clear);
    }

    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll("[data-reveal]").forEach(show);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          observer.unobserve(entry.target);
        }
      },
      // Fire slightly before the element reaches the viewport so the motion
      // has finished by the time it is properly in view.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    const seen = new WeakSet();
    let firstPass = true;

    const attach = () => {
      const fresh = [];
      document.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        fresh.push(el);
      });
      if (!fresh.length) return;

      const inView = [];
      for (const el of fresh) {
        const box = el.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) inView.push(el);
        else observer.observe(el);
      }

      if (!inView.length) return;

      if (reduced) {
        inView.forEach(show);
        return;
      }

      // Anything already on screen animates IN rather than being snapped
      // visible — otherwise the hero, the first thing anyone sees, has no
      // entrance at all and the page looks static on load.
      //
      // Two rAFs: the first lets the browser paint the pre-transition state
      // (opacity 0, shifted), the second flips the attribute so the
      // transition actually runs. Flipping it in the same frame as insertion
      // would jump straight to the end state.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inView.forEach((el, i) => {
            // Only stagger the initial page load; content that streams in
            // later (itinerary days, filtered cards) should appear at once.
            if (firstPass && !el.style.getPropertyValue("--reveal-delay")) {
              el.style.setProperty("--reveal-delay", `${Math.min(i, 8) * 70}ms`);
            }
            show(el);
          });
          firstPass = false;
        });
      });
    };

    attach();

    // Client-rendered content (streamed itinerary days, filtered tour cards,
    // concierge cards) arrives after mount — pick those up too.
    const mutations = new MutationObserver(attach);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return null;
}
