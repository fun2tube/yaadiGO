"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowIcon } from "../icons";

const formatINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

/**
 * A pinned section where scrolling DOWN moves a rail of departures SIDEWAYS,
 * each photo drifting slowly against its frame — a gallery walked past, not
 * a carousel clicked through.
 *
 * Cards are set like a printed programme: the photograph alone, and the date,
 * title, price and seats set beneath it in type. Nothing is laid over the
 * photo except the trip length.
 *
 * Progressive: the server renders a plain, native horizontal scroller. Only
 * after measuring does it become the pinned version, and it never does under
 * reduced motion — there it stays a row you swipe yourself.
 */
export default function HorizontalGallery({ items, intro, allHref, allLabel }) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const reduced = useReducedMotion();
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    if (reduced) return;
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setDistance(Math.max(0, track.scrollWidth - window.innerWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [reduced]);

  const pinned = !reduced && distance > 0;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const smoothX = useSpring(x, { stiffness: 160, damping: 36, mass: 0.5 });
  const drift = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        ref={sectionRef}
        className="relative bg-ink"
        // Pinned height = one screen + however far the rail has to travel.
        style={pinned ? { height: `calc(100vh + ${distance}px)` } : undefined}
      >
        <div
          className={
            pinned
              ? "sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden pt-16"
              : "py-24"
          }
        >
          <m.div
            ref={trackRef}
            className={`flex w-max items-end gap-6 px-6 sm:gap-10 sm:px-10 lg:px-14 ${
              pinned ? "" : "max-w-[100vw] snap-x overflow-x-auto pb-6"
            }`}
            style={pinned ? { x: smoothX } : undefined}
            // Keyboard: tabbing to an off-screen card would make the browser
            // scroll the clipped sticky box sideways, desyncing the rail.
            // Undo that, and scroll the PAGE to where the card is in view.
            onFocus={(event) => {
              if (!pinned) return;
              const box = event.currentTarget.parentElement;
              const card = event.target.closest("a");
              if (!card) return;
              const along = Math.min(distance, Math.max(0, card.offsetLeft - window.innerWidth * 0.2));
              // After the browser's own focus-scroll, which runs once this
              // handler returns and would otherwise win.
              setTimeout(() => {
                box.scrollLeft = 0;
                window.scrollTo({ top: sectionRef.current.offsetTop + along, behavior: "auto" });
              }, 0);
            }}
          >
            {/* The intro occupies the first frame of the rail rather than
                sitting above it, so the section opens on type and the
                departures arrive from the right. */}
            <div className="flex w-[84vw] shrink-0 flex-col justify-end self-stretch pb-2 pr-6 sm:w-[48vw] lg:w-[36vw]">
              {intro}
            </div>

            {items.map((item, i) => (
              <Link
                key={item.key ?? item.slug}
                href={item.href}
                data-cursor="View"
                className="group block w-[72vw] shrink-0 snap-start sm:w-[40vw] lg:w-[25vw]"
              >
                <div className="relative h-[50svh] max-h-[540px] min-h-[320px] overflow-hidden rounded-[3px] bg-ink-soft">
                  <m.div className="absolute inset-[-8%]" style={pinned ? { x: drift } : undefined}>
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 640px) 75vw, (max-width: 1024px) 42vw, 26vw"
                      className="object-cover transition-transform duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                    />
                  </m.div>
                  <div aria-hidden="true" className="absolute inset-0 bg-ink/10 transition-colors duration-700 group-hover:bg-ink/0" />
                  <span className="absolute right-3 top-3 bg-ink/45 px-2.5 py-1 eyebrow text-[10px] text-white/90 backdrop-blur-md">
                    {item.duration}
                  </span>
                  <span className="absolute bottom-3 left-3 font-mono text-[11px] text-white/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="mt-5 flex gap-5">
                  {item.date ? (
                    <span className="flex w-12 shrink-0 flex-col items-start">
                      <span className="display-light text-[40px] leading-[0.9] text-ink-text">{item.date.day}</span>
                      <span className="mt-1.5 eyebrow text-accent-bright">{item.date.month}</span>
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block font-display text-[22px] font-normal leading-tight tracking-[-0.01em] text-ink-text transition-colors duration-500 group-hover:text-accent-bright sm:text-[24px]">
                      {item.title}
                    </span>
                    <span className="mt-1.5 block truncate text-[12.5px] text-ink-text-faint">{item.destination}</span>
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3.5">
                  <span className="text-[12.5px] text-ink-text-muted">
                    {item.date ? "" : "from "}
                    <span className="font-display text-[17px] text-ink-text">{formatINR(item.price)}</span>
                    {item.date ? " per person" : ""}
                  </span>
                  {item.seats != null && (
                    <span
                      className={`eyebrow text-[10px] ${item.seats <= 5 ? "text-accent-bright" : "text-ink-text-faint"}`}
                    >
                      {item.seats} {item.seats === 1 ? "seat" : "seats"} left
                    </span>
                  )}
                </div>
              </Link>
            ))}

            <Link
              href={allHref}
              data-cursor="All tours"
              className="group flex h-[50svh] max-h-[540px] min-h-[320px] w-[60vw] shrink-0 snap-start flex-col justify-between self-start border-l border-ink-line-strong pl-8 text-ink-text sm:w-[30vw] lg:w-[20vw]"
            >
              <span className="eyebrow text-ink-text-faint">The full calendar</span>
              <span>
                <span className="display-light block text-[44px] leading-[1] sm:text-[56px]">
                  <em>See every</em> departure
                </span>
                <span className="mt-6 flex items-center gap-4 text-[14px] font-semibold text-ink-text-muted transition-colors group-hover:text-ink-text">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-line-strong transition-all duration-700 group-hover:border-accent group-hover:bg-accent">
                    <ArrowIcon />
                  </span>
                  {allLabel}
                </span>
              </span>
            </Link>
          </m.div>

          {pinned && (
            <div className="mx-6 mt-10 flex items-center gap-5 sm:mx-10 lg:mx-14">
              <span className="eyebrow text-ink-text-faint">Scroll</span>
              <div className="h-px flex-1 overflow-hidden bg-ink-line-strong">
                <m.div className="h-full origin-left bg-ink-text" style={{ scaleX: bar }} />
              </div>
              <span className="eyebrow text-ink-text-faint">{items.length} departures</span>
            </div>
          )}
        </div>
      </section>
    </LazyMotion>
  );
}
