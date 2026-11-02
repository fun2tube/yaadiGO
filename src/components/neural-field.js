"use client";

import { useEffect, useRef } from "react";

/**
 * The background graphic for dark sections: a drifting field of nodes that
 * link to their nearest neighbours, with a signal periodically firing along
 * one edge.
 *
 * Drawn flat — solid strokes and dots at varying alpha, no gradients
 * anywhere. Depth comes from opacity and line weight.
 *
 * It is built to be cheap, because a background that costs frames is worse
 * than no background:
 *   - node count scales with area and is capped hard on phones
 *   - neighbour search is O(n²) over a deliberately small n, not a quadtree
 *   - the loop stops entirely when the section scrolls out of view, and when
 *     the tab is hidden
 *   - DPR is clamped to 2, so a 3x phone doesn't render 9x the pixels
 *   - honours prefers-reduced-motion by drawing one static frame
 */
export default function NeuralField({
  className = "",
  density = 1,
  linkDistance = 150,
  color = "245, 243, 238",
  accent = "210, 114, 78",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let nodes = [];
    let frame = 0;
    let running = false;
    let signal = null;
    let nextSignalAt = 0;

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    function build() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width === 0 || height === 0) return;

      const ratio = dpr();
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      // One node per ~22,000px², capped so a large desktop doesn't quietly
      // turn into an O(n²) space heater.
      const target = Math.round(((width * height) / 22000) * density);
      const count = Math.max(12, Math.min(target, width < 640 ? 26 : 64));

      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
        r: Math.random() * 1.1 + 0.9,
      }));
    }

    /** Fires a pulse along one edge, so the field reads as active, not decorative. */
    function startSignal(now) {
      if (nodes.length < 2) return;
      const from = Math.floor(Math.random() * nodes.length);
      let to = -1;
      let best = linkDistance;
      for (let i = 0; i < nodes.length; i++) {
        if (i === from) continue;
        const d = Math.hypot(nodes[i].x - nodes[from].x, nodes[i].y - nodes[from].y);
        if (d < best) {
          best = d;
          to = i;
        }
      }
      if (to === -1) return;
      signal = { from, to, start: now, duration: 900 };
    }

    function draw(now) {
      ctx.clearRect(0, 0, width, height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        // Wrap rather than bounce: bouncing makes the motion legible as a
        // loop, wrapping keeps it feeling continuous.
        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > linkDistance) continue;
          // Nearer pairs draw a stronger line; this is the whole depth model.
          const alpha = (1 - dist / linkDistance) * 0.3;
          ctx.strokeStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      for (const node of nodes) {
        ctx.fillStyle = `rgba(${color}, 0.5)`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) {
        if (!signal && now >= nextSignalAt) {
          startSignal(now);
          nextSignalAt = now + 1400 + Math.random() * 2200;
        }

        if (signal) {
          const t = (now - signal.start) / signal.duration;
          if (t >= 1) {
            signal = null;
          } else {
            const a = nodes[signal.from];
            const b = nodes[signal.to];
            if (a && b) {
              // Ease so the pulse decelerates into the target node.
              const eased = 1 - Math.pow(1 - t, 3);
              const x = a.x + (b.x - a.x) * eased;
              const y = a.y + (b.y - a.y) * eased;
              const fade = Math.sin(t * Math.PI);

              ctx.strokeStyle = `rgba(${accent}, ${(fade * 0.55).toFixed(3)})`;
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(x, y);
              ctx.stroke();
              ctx.lineWidth = 1;

              ctx.fillStyle = `rgba(${accent}, ${fade.toFixed(3)})`;
              ctx.beginPath();
              ctx.arc(x, y, 2.4, 0, Math.PI * 2);
              ctx.fill();
            } else {
              signal = null;
            }
          }
        }
      }
    }

    function loop(now) {
      if (!running) return;
      draw(now);
      frame = requestAnimationFrame(loop);
    }

    function start() {
      if (running || reduced) return;
      running = true;
      frame = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    build();
    draw(performance.now());
    if (!reduced) start();

    // Only animate while the section is actually on screen.
    const visibility = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 }
    );
    visibility.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        build();
        draw(performance.now());
      }, 180);
    };
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
    };
  }, [density, linkDistance, color, accent]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
