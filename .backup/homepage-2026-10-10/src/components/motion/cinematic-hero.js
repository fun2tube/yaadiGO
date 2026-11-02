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

const SLIDE_MS = 7000;

/**
 * The first screen: full-bleed destination photography, cross-fading with a
 * slow push-in, and a scroll exit that does three things at once — the frame
 * shrinks into a rounded card, the photo keeps zooming, and the copy lifts
 * and fades. It reads as the camera pulling back from the place.
 *
 * Slide 1 is server-rendered and preloaded; the rest mount after hydration so
 * a phone on 4G pays for one hero image before the page is usable, not five.
 *
 * `children` is the server-rendered content (ask bar, stats) — it stays a
 * server tree, this component only moves it.
 */
export default function CinematicHero({ slides, children }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const [index, setIndex] = useState(0);
  const [loadRest, setLoadRest] = useState(false);
  const [paused, setPaused] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.35]);
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const side = useTransform(scrollYProgress, [0, 0.9], [0, 4]);
  const bottom = useTransform(scrollYProgress, [0, 0.9], [0, 6]);
  const radius = useTransform(scrollYProgress, [0, 0.6], [0, 40]);
  const clipPath = useMotionTemplate`inset(0% ${side}% ${bottom}% ${side}% round 0 0 ${radius}px ${radius}px)`;
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const contentOpacity = useLiveTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const veil = useLiveTransform(scrollYProgress, [0, 1], [0, 0.55]);

  // The other slides start downloading once the first has had its moment.
  useEffect(() => {
    const t = setTimeout(() => setLoadRest(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Advance only while visible and the tab is in front — a slideshow nobody
  // is looking at is battery spent for nothing.
  useEffect(() => {
    if (reduced || !loadRest || paused || slides.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, reduced, loadRest, paused, slides.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting));
    io.observe(el);
    const onVis = () => document.hidden && setPaused(true);
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
          <m.div
            className="absolute inset-0"
            style={motionOn ? { scale: imageScale, y: imageY } : undefined}
          >
            {slides.map((slide, i) => {
              if (i > 0 && !loadRest) return null;
              const active = i === index;
              return (
                <div
                  key={slide.id}
                  aria-hidden={!active}
                  className="absolute inset-0 transition-opacity duration-[1600ms] ease-out"
                  style={{ opacity: active ? 1 : 0 }}
                >
                  {/* Remounting on activation restarts the push-in. */}
                  <div
                    key={active ? `on-${index}` : "off"}
                    className={`absolute inset-0 ${active ? "animate-ken-burns" : ""}`}
                  >
                    <Image
                      src={slide.src}
                      alt={active ? slide.alt : ""}
                      fill
                      sizes="100vw"
                      preload={i === 0}
                      className="object-cover"
                    />
                  </div>
                </div>
              );
            })}
          </m.div>

          {/* Legibility: a flat ink wash, plus a heavier band at the bottom
              drawn as a masked solid rather than a gradient fill. */}
          <div aria-hidden="true" className="absolute inset-0 bg-ink/35" />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-3/4 bg-ink/80"
            style={{ maskImage: "linear-gradient(to top, #000 15%, transparent)" }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-2/3 bg-ink/50"
            style={{ maskImage: "linear-gradient(to right, #000 10%, transparent)" }}
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
          <div className="mx-auto w-full max-w-6xl px-6 pb-10 pt-28 sm:px-10 sm:pb-14">
            {children}

            {/* Caption + slide timer. Doubles as the slide picker. */}
            <div className="mt-10 flex flex-col gap-4 border-t border-white/15 pt-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <span className="eyebrow text-white/55">Now showing</span>
                <p
                  key={current.id}
                  className="animate-fade-up mt-1 truncate font-display text-[17px] font-semibold text-white"
                >
                  {current.title}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-[12px] tabular-nums text-white/70">
                  {String(index + 1).padStart(2, "0")}
                  <span className="text-white/35"> / {String(slides.length).padStart(2, "0")}</span>
                </span>
                <div className="flex gap-1.5">
                  {slides.map((slide, i) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => {
                        setLoadRest(true);
                        setIndex(i);
                      }}
                      aria-label={`Show ${slide.title}`}
                      aria-current={i === index}
                      className="group flex h-8 items-center"
                    >
                      <span className="relative block h-[3px] w-7 overflow-hidden rounded-full bg-white/25 transition-all group-hover:bg-white/45 sm:w-10">
                        {i === index && (
                          <span
                            key={`bar-${index}-${paused}`}
                            className={`absolute inset-0 rounded-full bg-white ${
                              reduced || paused ? "" : "animate-bar-fill"
                            }`}
                            style={{ "--bar-duration": `${SLIDE_MS}ms` }}
                          />
                        )}
                        {i < index && <span className="absolute inset-0 rounded-full bg-white/70" />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-6 right-6 hidden flex-col items-center gap-3 sm:flex"
          >
            <span className="eyebrow text-white/60 [writing-mode:vertical-rl]">Scroll</span>
            <span className="relative block h-14 w-px overflow-hidden bg-white/20">
              <span className="animate-scroll-cue absolute inset-0 bg-white" />
            </span>
          </div>
        </m.div>
      </section>
    </LazyMotion>
  );
}
