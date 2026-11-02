"use client";

import { useState } from "react";
import { ClockIcon, SparkleIcon, CheckIcon } from "@/components/icons";
import { hasContent } from "@/lib/slot-text";

const SLOTS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
];

export function DayCardSkeleton() {
  return (
    <div className="print-block rounded-2xl border border-paper-line bg-card p-6">
      <div className="skeleton h-4 w-24 rounded" />
      <div className="skeleton mt-3 h-6 w-2/3 rounded" />
      <div className="mt-5 flex flex-col gap-2.5">
        <div className="skeleton h-3.5 w-full rounded" />
        <div className="skeleton h-3.5 w-11/12 rounded" />
        <div className="skeleton h-3.5 w-4/5 rounded" />
      </div>
    </div>
  );
}

export default function DayCard({ day, onRegenerate, busy, canRegenerate }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");

  function submit(event) {
    event.preventDefault();
    onRegenerate(instruction.trim());
    setOpen(false);
    setInstruction("");
  }

  return (
    <article
      data-reveal
      className={`print-block relative overflow-hidden rounded-2xl border bg-card transition-all ${
        busy ? "border-accent/40 ring-4 ring-accent/10" : "border-paper-line hover:border-accent/30"
      }`}
    >
      {/* Day number spine */}
      <div className="absolute left-0 top-0 h-full w-1 bg-accent/70" aria-hidden="true" />

      <div className="p-6 pl-7 sm:p-7 sm:pl-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-accent/12 px-2 py-1 eyebrow text-accent-deep">
                Day {day.day}
              </span>
              <span className="text-[12.5px] font-semibold text-paper-text-faint">
                {day.location}
              </span>
            </div>
            <h3 className="mt-2.5 font-display text-[19px] font-bold leading-snug text-paper-text sm:text-[21px]">
              {day.title}
            </h3>
          </div>

          {canRegenerate && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              disabled={busy}
              className="no-print flex shrink-0 items-center gap-1.5 rounded-full border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-bold text-paper-text-muted transition-colors hover:border-accent hover:text-accent-deep disabled:opacity-50"
            >
              <SparkleIcon size={13} />
              {busy ? "Rewriting…" : "Redo this day"}
            </button>
          )}
        </div>

        {open && (
          <form onSubmit={submit} className="no-print mt-4 rounded-xl bg-paper-dim p-4">
            <label
              htmlFor={`instruction-${day.day}`}
              className="eyebrow text-paper-text-faint"
            >
              What should change? (optional)
            </label>
            <input
              id={`instruction-${day.day}`}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={300}
              placeholder="Less driving. Or: swap the fort for something outdoors."
              className="mt-2 w-full rounded-lg border border-paper-line-strong bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-accent"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-ink-text"
              >
                Rewrite day {day.day}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-[13px] font-semibold text-paper-text-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-5 flex flex-col gap-3.5">
          {SLOTS.filter((slot) => hasContent(day[slot.key])).map((slot) => (
            <div key={slot.key} className="flex gap-3.5">
              <span className="mt-[3px] w-[68px] shrink-0 eyebrow text-accent-deep">
                {slot.label}
              </span>
              <p className="flex-1 text-[14.5px] leading-relaxed text-paper-text-muted">
                {day[slot.key]}
              </p>
            </div>
          ))}
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-paper-line pt-4 sm:grid-cols-3">
          <div>
            <dt className="eyebrow text-paper-text-faint">
              Stay
            </dt>
            <dd className="mt-1 text-[13.5px] leading-snug text-paper-text">{day.stay}</dd>
          </div>
          <div>
            <dt className="eyebrow text-paper-text-faint">
              Eat
            </dt>
            <dd className="mt-1 text-[13.5px] leading-snug text-paper-text">{day.meals}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 eyebrow text-paper-text-faint">
              <ClockIcon size={12} color="currentColor" /> Transfers
            </dt>
            <dd className="mt-1 text-[13.5px] leading-snug text-paper-text">{day.travelTime}</dd>
          </div>
        </dl>

        {day.tips?.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 rounded-xl bg-accent/6 p-4">
            {day.tips.map((tip, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-paper-text">
                <span className="mt-[3px] shrink-0 text-accent-deep">
                  <CheckIcon size={13} />
                </span>
                {tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
