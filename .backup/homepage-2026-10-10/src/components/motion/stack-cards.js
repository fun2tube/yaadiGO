"use client";

import { useRef } from "react";
import Image from "next/image";
import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useHydrated, useLiveTransform } from "./shared";

/**
 * Cards that pin one on top of the next as you scroll. Each card, once
 * covered, shrinks back and dims — a deck being dealt.
 *
 * Uses `position: sticky` for the pinning (no JS needed for that part); motion
 * only adds the scale-and-dim on cards already passed.
 *
 * `cards` items: { n, title: node, detail: node, image?: { src, alt }, note? }.
 * Without an image the step gets a flat colour panel with a giant numeral.
 */
export default function StackCards({ cards }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const on = hydrated && !reduced;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <LazyMotion features={domAnimation} strict>
      <div ref={ref} className="relative">
        {cards.map((card, i) => (
          <StackCard
            key={card.n}
            card={card}
            i={i}
            count={cards.length}
            progress={scrollYProgress}
            on={on}
          />
        ))}
      </div>
    </LazyMotion>
  );
}

// Flat panel colours for photo-less steps, from the design tokens.
const PANEL_TONES = ["bg-accent", "bg-ink-soft", "bg-accent-deep", "bg-good"];

function StackCard({ card, i, count, progress, on }) {
  const start = i / count;
  const target = 1 - (count - 1 - i) * 0.05;
  const scale = useTransform(progress, [start, 1], [1, target]);
  const dim = useLiveTransform(progress, [start, 1], [0, (count - 1 - i) * 0.12]);
  const imgScale = useTransform(progress, [start - 0.25, start + 0.1], [1.3, 1]);

  return (
    <div
      className="sticky flex h-[78svh] items-start justify-center pb-6"
      style={{ top: `calc(14svh + ${i * 22}px)` }}
    >
      <m.article
        className={`relative grid h-full max-h-[480px] w-full origin-top overflow-hidden rounded-[28px] border border-paper-line bg-card shadow-2xl shadow-ink/10 ${
          card.image ? "md:grid-cols-[1.1fr_1fr]" : "md:grid-cols-[0.7fr_1.3fr]"
        }`}
        style={on ? { scale } : undefined}
      >
        <div
          className={`relative min-h-[170px] overflow-hidden ${card.image ? "" : PANEL_TONES[i % PANEL_TONES.length]}`}
        >
          {card.image ? (
            <m.div className="absolute inset-0" style={on ? { scale: imgScale } : undefined}>
              <Image
                src={card.image.src}
                alt={card.image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </m.div>
          ) : (
            // No photo: the number IS the picture — huge, bleeding off the
            // panel, growing into place as the card arrives.
            <m.span
              aria-hidden="true"
              className="absolute -bottom-8 -right-2 origin-bottom-right font-display text-[200px] font-black leading-none text-white/90 sm:text-[300px]"
              style={on ? { scale: imgScale } : undefined}
            >
              {card.n}
            </m.span>
          )}
          {card.image ? (
            <span className="absolute left-5 top-4 font-display text-[88px] font-black leading-none text-white/85 mix-blend-overlay sm:text-[120px]">
              {String(card.n).padStart(2, "0")}
            </span>
          ) : (
            card.note && (
              <span className="absolute left-5 top-5 rounded-full bg-white/20 px-3 py-1 eyebrow text-white backdrop-blur-sm">
                {card.note}
              </span>
            )
          )}
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <span className="eyebrow text-accent-deep">
            Step {card.n} of {count}
          </span>
          <div className="mt-3 font-display text-[26px] font-black leading-tight text-paper-text sm:text-[34px]">
            {card.title}
          </div>
          <div className="mt-3 max-w-sm text-[15px] leading-relaxed text-paper-text-muted">
            {card.detail}
          </div>
        </div>
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-ink"
          style={{ opacity: on ? dim : 0 }}
        />
      </m.article>
    </div>
  );
}
