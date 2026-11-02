"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  LazyMotion,
  domAnimation,
  m,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useHydrated, useLiveTransform } from "./shared";

const SLIDE_MS = 8000;

/**
 * The first screen, art-directed as a film title rather than a banner.
 *
 * On load the photograph opens from a framed window to full bleed while it
 * settles from a zoom, and the headline rises word by word just behind it
 * (all CSS, so it plays from the server HTML). Slides then cross-fade slowly
 * with a drift you sense rather than watch. On scroll the photo sinks and
 * deepens while the copy lifts away — the camera pulling back.
 *
 * Slide 1 is server-rendered and preloaded; the rest mount after hydration so
 * a phone on 4G pays for one hero image before the page is usable, not five.
 *
 * `children` is the server-rendered copy — it stays a server tree; this
 * component only frames and moves it.
 */
export default function CinematicHero({ slides, children }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const [index, setIndex] = useState(0);
  const [loadRest, setLoadRest] = useState(false);
  const [paused, setPaused] = useState(false);
  // Slides whose photo has actually arrived. The first is server-rendered and
  // preloaded, and its load event can fire before hydration, so it starts
  // counted. The slideshow never cross-fades to a photo still downloading —
  // on a slow connection that showed a black frame for seconds.
  const [ready, setReady] = useState(() => new Set([0]));

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const side = useTransform(scrollYProgress, [0, 0.9], [0, 2.5]);
  const bottom = useTransform(scrollYProgress, [0, 0.9], [0, 4]);
  const radius = useTransform(scrollYProgress, [0, 0.6], [0, 6]);
  const clipPath = useMotionTemplate`inset(0% ${side}% ${bottom}% ${side}% round 0 0 ${radius}px ${radius}px)`;
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const contentOpacity = useLiveTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const veil = useLiveTransform(scrollYProgress, [0, 1], [0, 0.65]);

  // The other slides start downloading once the first has had its moment.
  useEffect(() => {
    const t = setTimeout(() => setLoadRest(true), 2400);
    return () => clearTimeout(t);
  }, []);

  // Advance only while visible and the tab is in front — a slideshow nobody
  // is looking at is battery spent for nothing.
  const next = (index + 1) % slides.length;
  const nextReady = ready.has(next);
  useEffect(() => {
    if (reduced || !loadRest || paused || slides.length < 2 || !nextReady) return;
    const t = setTimeout(() => setIndex(next), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, next, nextReady, reduced, loadRest, paused, slides.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Both conditions are tracked, so returning to the tab resumes the slides
    // only if the hero is actually on screen.
    let inView = true;
    const sync = () => setPaused(!inView || document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    const onVis = sync;
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const motionOn = hydrated && !reduced;
  const current = slides[index];

  return (
    <LazyMotion features={domAnimation} strict>
      <section ref={ref} className="relative min-h-[100svh] bg-ink">
        <m.div
          className="absolute inset-0 overflow-hidden bg-ink"
          style={motionOn ? { clipPath } : undefined}
        >
          <div className="animate-hero-open absolute inset-0 overflow-hidden">
            <m.div
              className="absolute inset-0"
              style={motionOn ? { scale: imageScale, y: imageY } : undefined}
            >
              <div className="animate-hero-settle absolute inset-0">
                {slides.map((slide, i) => {
                  if (i > 0 && !loadRest) return null;
                  const active = i === index;
                  return (
                    <div
                      key={slide.id}
                      aria-hidden={!active}
                      className="absolute inset-0 transition-opacity duration-[2200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ opacity: active ? 1 : 0 }}
                    >
                      {/* Remounting on activation restarts the drift. */}
                      <div
                        key={active ? `on-${index}` : "off"}
                        className={`absolute inset-0 ${active ? "animate-slow-drift" : ""}`}
                      >
                        <Image
                          src={slide.src}
                          alt={active ? slide.alt : ""}
                          fill
                          sizes="100vw"
                          preload={i === 0}
                          onLoad={() => setReady((r) => (r.has(i) ? r : new Set(r).add(i)))}
                          className="object-cover"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </m.div>
          </div>

          {/* Legibility: a light flat wash, then heavier bands at the bottom
              and left drawn as masked solids rather than gradient fills. */}
          <div aria-hidden="true" className="absolute inset-0 bg-ink/25" />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[70%] bg-ink/85"
            style={{ maskImage: "linear-gradient(to top, #000 10%, transparent)" }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-40 bg-ink/50"
            style={{ maskImage: "linear-gradient(to bottom, #000, transparent)" }}
          />
          <m.div
            aria-hidden="true"
            className="absolute inset-0 bg-ink"
            style={{ opacity: motionOn ? veil : 0 }}
          />
        </m.div>

        <m.div
          className="relative flex min-h-[100svh] flex-col justify-end"
          style={motionOn ? { y: contentY, opacity: contentOpacity } : undefined}
        >
          <div className="mx-auto w-full max-w-[1400px] px-6 pb-8 pt-32 sm:px-10 sm:pb-10 lg:px-14">
            {children}

            {/* Caption + slide picker, set like a film credit. */}
            <div className="animate-fade-up mt-12 grid grid-cols-1 items-end gap-5 border-t border-white/15 pt-5 sm:grid-cols-[1fr_auto]" style={{ "--fade-delay": "1500ms" }}>
              <p className="flex min-w-0 items-baseline gap-4 text-white">
                <span className="eyebrow shrink-0 text-white/45">Now showing</span>
                <span
                  key={current.id}
                  className="animate-fade-up display-italic truncate font-display text-[19px] text-white/90"
                >
                  {current.title}
                </span>
              </p>

              <div className="flex items-center gap-1">
                {slides.map((slide, i) => {
                  const active = i === index;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => {
                        setLoadRest(true);
                        setIndex(i);
                      }}
                      aria-label={`Show ${slide.title}`}
                      aria-current={active}
                      className="group flex h-10 w-11 flex-col justify-center gap-2 sm:w-14"
                    >
                      <span
                        className={`font-mono text-[11px] tabular-nums transition-colors duration-500 ${
                          active ? "text-white" : "text-white/35 group-hover:text-white/70"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="relative block h-px w-full overflow-hidden bg-white/20">
                        {active && (
                          <span
                            key={`bar-${index}-${paused}`}
                            className={`absolute inset-0 bg-white ${
                              reduced || paused ? "" : "animate-bar-fill"
                            }`}
                            style={{ "--bar-duration": `${SLIDE_MS}ms` }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-4 lg:right-10 lg:flex"
          >
            <span className="eyebrow text-white/50 [writing-mode:vertical-rl]">Scroll to explore</span>
            <span className="relative block h-16 w-px overflow-hidden bg-white/20">
              <span className="animate-scroll-cue absolute inset-0 bg-white" />
            </span>
          </div>
        </m.div>
      </section>
    </LazyMotion>
  );
}
