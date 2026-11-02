"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useFinePointer, useHydrated } from "./shared";

/**
 * A button that leans toward the cursor and springs back when it leaves.
 * Mouse and trackpad only — on touch it is an ordinary button.
 */
export function Magnetic({ children, strength = 0.35, className = "" }) {
  const ref = useRef(null);
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.6 });
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.6 });
  const active = fine && !reduced;

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        ref={ref}
        className={`inline-flex ${className}`}
        style={active ? { x, y } : undefined}
        onPointerMove={(e) => {
          if (!active) return;
          const box = ref.current.getBoundingClientRect();
          x.set((e.clientX - (box.left + box.width / 2)) * strength);
          y.set((e.clientY - (box.top + box.height / 2)) * strength);
        }}
        onPointerLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

/**
 * A full-bleed photograph behind a block of content. The photo travels
 * slower than the page and settles from a slight zoom as you arrive.
 */
export function ParallaxBackdrop({
  src,
  alt,
  children,
  className = "",
  veil = "bg-ink/60",
  preload = false,
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const on = hydrated && !reduced;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-14%", "14%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.25, 1.1, 1.2]);

  return (
    <LazyMotion features={domAnimation} strict>
      <section ref={ref} className={`relative overflow-hidden bg-ink ${className}`}>
        <m.div className="absolute inset-[-12%_0]" style={on ? { y, scale } : undefined}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes="100vw"
            preload={preload}
            className="object-cover"
          />
        </m.div>
        <div aria-hidden="true" className={`absolute inset-0 ${veil}`} />
        <div className="relative">{children}</div>
      </section>
    </LazyMotion>
  );
}
