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
  useVelocity,
} from "motion/react";
import { ChevronIcon } from "../icons";

const formatINR = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

/**
 * "Where to next" — a pinned section where scrolling DOWN moves a rail of
 * destinations SIDEWAYS. The rail skews slightly with scroll speed and every
 * photo drifts against its frame, so a fast flick feels physical.
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

  const { scrollY, scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const smoothX = useSpring(x, { stiffness: 120, damping: 28, mass: 0.4 });
  const velocity = useVelocity(scrollY);
  const skew = useSpring(useTransform(velocity, [-3000, 3000], [6, -6]), {
    stiffness: 200,
    damping: 30,
  });
  const drift = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
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
              ? "sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden"
              : "py-20"
          }
        >
          <m.div
            ref={trackRef}
            className={`flex w-max items-stretch gap-5 px-6 sm:gap-7 sm:px-10 ${
              pinned ? "" : "max-w-[100vw] snap-x overflow-x-auto pb-6"
            }`}
            style={pinned ? { x: smoothX, skewX: skew } : undefined}
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
                destinations slide in from the right. */}
            <div className="flex w-[82vw] shrink-0 flex-col justify-center pr-4 sm:w-[46vw] lg:w-[34vw]">
              {intro}
            </div>

            {items.map((item, i) => (
              <Link
                key={item.key ?? item.slug}
                href={item.href}
                className="group relative block h-[62svh] max-h-[620px] min-h-[380px] w-[74vw] shrink-0 snap-start overflow-hidden rounded-[28px] bg-ink-soft sm:w-[42vw] lg:w-[28vw]"
              >
                <m.div
                  className="absolute inset-[-10%]"
                  style={pinned ? { x: drift } : undefined}
                >
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 30vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                  />
                </m.div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-ink/75"
                  style={{ maskImage: "linear-gradient(to top, #000 10%, transparent 60%)" }}
                />

                {/* A departure shows its date; anything else, its position. */}
                {item.date ? (
                  <span className="absolute left-4 top-4 flex flex-col items-center rounded-2xl bg-white px-3.5 py-2 text-ink shadow-lg">
                    <span className="font-display text-[26px] font-black leading-none">{item.date.day}</span>
                    <span className="mt-0.5 eyebrow text-accent-deep">{item.date.month}</span>
                  </span>
                ) : (
                  <span className="absolute left-5 top-4 font-display text-[64px] font-black leading-none text-white/20 transition-colors duration-500 group-hover:text-white/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                )}
                <span className="absolute right-4 top-4 rounded-full bg-ink/55 px-3 py-1 eyebrow text-white backdrop-blur-md">
                  {item.duration}
                </span>

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <span className="eyebrow text-white/65">{item.destination}</span>
                  <h3 className="mt-1.5 font-display text-[24px] font-bold leading-tight text-white sm:text-[28px]">
                    {item.title}
                  </h3>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[13px] text-white/70">
                      {item.date ? "" : "from "}
                      <span className="font-display text-[18px] font-bold text-white">
                        {formatINR(item.price)}
                      </span>
                      {item.date ? " per person" : ""}
                      {item.seats != null && (
                        <span
                          className={`mt-1 block text-[12px] font-semibold ${
                            item.seats <= 5 ? "text-warn-soft" : "text-white/70"
                          }`}
                        >
                          {item.seats} {item.seats === 1 ? "seat" : "seats"} left
                        </span>
                      )}
                    </span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-45 group-hover:scale-110">
                      <ChevronIcon size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            <Link
              href={allHref}
              className="group flex h-[62svh] max-h-[620px] min-h-[380px] w-[60vw] shrink-0 snap-start flex-col items-center justify-center gap-5 rounded-[28px] border border-ink-line-strong text-ink-text transition-colors hover:border-accent sm:w-[30vw] lg:w-[22vw]"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-white transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-125">
                <ChevronIcon size={26} />
              </span>
              <span className="font-display text-[22px] font-bold">{allLabel}</span>
            </Link>
          </m.div>

          {pinned && (
            <div className="mx-6 mt-8 h-px overflow-hidden bg-ink-line-strong sm:mx-10">
              <m.div className="h-full origin-left bg-accent" style={{ scaleX: bar }} />
            </div>
          )}
        </div>
      </section>
    </LazyMotion>
  );
}
