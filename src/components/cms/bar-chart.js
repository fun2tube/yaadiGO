"use client";

import { useState } from "react";

/**
 * One series of bars over time — quotes sent per day, bookings per month.
 *
 * Deliberately one measure per chart: counts and rupees are different scales,
 * and two y-axes on one chart is the classic way to make a picture lie. So a
 * screen that wants both shows two of these.
 *
 * Bars: thin, 4 px rounded at the data end, anchored to the baseline, 2 px
 * apart. Grid and axes recessive. Hover (or focus) a bar for its value; the
 * table toggle gives the same numbers to screen readers and to anyone who
 * wants to copy them.
 */

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const compactInr = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${Math.round(v / 1e3)}k`;
  return `₹${v}`;
};

function niceMax(max) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max / 4) * pow;
  return Math.ceil(max / step) * step;
}

export default function BarChart({ title, data, format = "count", height = 160, emptyText = "Nothing in this period." }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const fmt = format === "money" ? inr : (n) => Number(n || 0).toLocaleString("en-IN");
  const tick = format === "money" ? compactInr : (n) => Number(n || 0).toLocaleString("en-IN");

  const values = data.map((d) => Number(d.value) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(0, ...values));

  const W = 640;
  const H = height;
  const padL = 44;
  const padB = 22;
  const padT = 8;
  const plotW = W - padL - 6;
  const plotH = H - padB - padT;
  const slot = data.length ? plotW / data.length : plotW;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  // Thin the x labels so they never collide: at most ~8 on the axis.
  const every = Math.max(1, Math.ceil(data.length / 8));

  return (
    <figure className="rounded-2xl border border-paper-line bg-card p-4">
      <figcaption className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-paper-text">{title}</p>
          <p className="font-mono text-[10.5px] text-paper-text-faint">
            {fmt(total)} in total
            {hover !== null && data[hover] ? ` · ${data[hover].label}: ${fmt(data[hover].value)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          className="shrink-0 rounded-lg border border-paper-line-strong px-2 py-1 font-mono text-[10px] font-bold text-paper-text-muted"
        >
          {asTable ? "Chart" : "Table"}
        </button>
      </figcaption>

      {total === 0 ? (
        <p className="py-8 text-center text-[12.5px] text-paper-text-faint">{emptyText}</p>
      ) : asTable ? (
        <div className="mt-3 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="font-mono text-[10px] uppercase text-paper-text-faint">
                <th className="py-1 font-normal">Period</th>
                <th className="py-1 text-right font-normal">{format === "money" ? "Value" : "Count"}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key ?? d.label} className="border-t border-paper-line">
                  <td className="py-1 text-paper-text-muted">{d.label}</td>
                  <td className="py-1 text-right font-semibold text-paper-text">{fmt(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${title}: ${fmt(total)} in total`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => {
            const y = padT + plotH - (t / max) * plotH;
            return (
              <g key={t}>
                <line x1={padL} x2={W - 6} y1={y} y2={y} stroke="currentColor" className="text-paper-line" strokeWidth="1" />
                <text x={padL - 6} y={y + 3.5} textAnchor="end" className="fill-paper-text-faint" fontSize="10" fontFamily="ui-monospace, monospace">
                  {tick(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const v = Number(d.value) || 0;
            const h = (v / max) * plotH;
            const x = padL + i * slot + (slot - barW) / 2;
            const y = padT + plotH - h;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={d.key ?? i}>
                {/* Hit target: the whole slot, taller than the bar. */}
                <rect
                  x={padL + i * slot}
                  y={padT}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${fmt(v)}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
                {v > 0 && (
                  <path
                    d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                    className={hover === i ? "fill-accent-deep" : "fill-accent"}
                    pointerEvents="none"
                  />
                )}
                {i % every === 0 && (
                  <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="fill-paper-text-faint" fontSize="10">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={padL} x2={W - 6} y1={padT + plotH} y2={padT + plotH} stroke="currentColor" className="text-paper-line-strong" strokeWidth="1" />
        </svg>
      )}
    </figure>
  );
}
