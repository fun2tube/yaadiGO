"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronIcon } from "@/components/icons";

export const DEPARTURE_STATUS = {
  available: ["Open", "bg-good/15 text-good"],
  filling: ["Filling", "bg-warn/20 text-warn"],
  soldout: ["Sold out", "bg-ink text-ink-text"],
  closed: ["Closed", "bg-paper-line-strong text-paper-text-muted"],
  cancelled: ["Cancelled", "bg-danger/10 text-danger"],
  completed: ["Ran", "bg-paper-line text-paper-text-faint"],
};

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "attention", label: "Needs attention" },
  { key: "past", label: "Past & cancelled" },
];

/** Why a batch needs someone to look at it — in the words of the action. */
function attention(row) {
  const reasons = [];
  if (row.atRisk) reasons.push(`${row.booked}/${row.minToRun} booked — short of the minimum`);
  if (row.waiting > 0 && row.seatsLeft > 0 && row.status !== "closed") reasons.push(`${row.waiting} waiting and a seat is free`);
  if (row.holdsExpiringSoon > 0) reasons.push(`${row.holdsExpiringSoon} hold${row.holdsExpiringSoon === 1 ? "" : "s"} expiring within 12h`);
  return reasons;
}

const month = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const day = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export default function DepartureBoard({ rows }) {
  const [filter, setFilter] = useState("upcoming");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const done = (r) => r.status === "completed" || r.status === "cancelled";
  const visible = rows
    .filter((r) => (filter === "past" ? done(r) : !done(r)))
    .filter((r) => filter !== "attention" || attention(r).length > 0)
    .filter((r) => !needle || r.tripTitle.toLowerCase().includes(needle));
  if (filter === "past") visible.reverse();

  const counts = {
    upcoming: rows.filter((r) => !done(r)).length,
    attention: rows.filter((r) => !done(r) && attention(r).length > 0).length,
    past: rows.filter(done).length,
  };

  // A month heading above the first batch of each month.
  const items = visible.map((r, i) => ({
    r,
    header: i === 0 || month(visible[i - 1].start) !== month(r.start) ? month(r.start) : null,
  }));

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by trip…"
        className="w-full rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[14px] outline-none focus:border-accent"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold ${
              filter === f.key ? "border-ink bg-ink text-ink-text" : "border-paper-line-strong text-paper-text-muted"
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 text-[10.5px] ${filter === f.key ? "bg-white/15" : "bg-paper-dim"} ${f.key === "attention" && counts.attention ? "text-warn" : ""}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {items.map(({ r, header }) => {
          const [label, style] = DEPARTURE_STATUS[r.status] ?? DEPARTURE_STATUS.available;
          const reasons = attention(r);
          const filled = r.capacity ? Math.min(100, Math.round(((r.booked + r.held) / r.capacity) * 100)) : 0;
          return (
            <div key={`${r.tripSlug}:${r.id}`}>
              {header && (
                <p className="mb-1.5 mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-paper-text-faint">
                  {header}
                </p>
              )}
              <Link
                href={`/admin/departures/${r.tripSlug}/${r.id}`}
                className="flex items-center gap-3 rounded-2xl border border-paper-line bg-card p-3.5 transition-colors hover:border-accent/40"
              >
                <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-paper-dim py-1.5">
                  <span className="font-display text-[18px] font-black leading-none text-paper-text">{day(r.start).split(" ")[0]}</span>
                  <span className="mt-0.5 font-mono text-[9.5px] uppercase text-paper-text-faint">{day(r.start).split(" ")[1]}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[14.5px] font-bold text-paper-text">{r.tripTitle}</span>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${style}`}>{label}</span>
                    {r.guaranteed && (
                      <span className="rounded bg-good/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-good">Guaranteed</span>
                    )}
                    {!r.tripListed && (
                      <span className="rounded bg-paper-line-strong px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-paper-text-faint">Trip not listed</span>
                    )}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-paper-text-muted">
                    {r.booked} booked · {r.held} held · <span className="font-semibold text-paper-text">{r.seatsLeft} left</span> of {r.capacity}
                    {r.waiting > 0 && ` · ${r.waiting} waiting`}
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-dim" aria-hidden="true">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${filled}%` }} />
                  </span>
                  {reasons.length > 0 && filter !== "past" && (
                    <span className="mt-1.5 block text-[12px] font-semibold text-warn">{reasons.join(" · ")}</span>
                  )}
                </span>
                <ChevronIcon size={14} className="shrink-0 text-paper-text-faint" />
              </Link>
            </div>
          );
        })}

        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-paper-line-strong p-6 text-center text-[13px] text-paper-text-muted">
            {filter === "attention"
              ? "Nothing needs attention right now."
              : rows.length === 0
                ? "No departures yet. Add batches to a group trip from its Departures tab."
                : "No departures match."}
          </p>
        )}
      </div>
    </div>
  );
}
