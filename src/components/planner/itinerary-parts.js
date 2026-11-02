import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * The parts of a generated itinerary that are a DOCUMENT rather than a tool —
 * shared by the planner on screen and the PDF render target
 * (`/pdf/itinerary`), so the file someone downloads is the plan they read.
 */

export function ItineraryHeader({ header }) {
  return (
    <div
      data-reveal
      className="print-block overflow-hidden rounded-2xl border border-paper-line bg-ink p-7 text-ink-text sm:p-9"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-accent px-2.5 py-1 eyebrow text-white">
          {header.durationDays} days
        </span>
        <span className="text-[12.5px] font-bold uppercase tracking-[0.1em] text-ink-text-faint">
          {header.destination}
        </span>
      </div>
      <h2 className="mt-3 font-display text-[26px] font-black leading-tight sm:text-[34px]">
        {header.title}
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-text-muted">
        {header.summary}
      </p>

      <div className="mt-6 grid gap-5 border-t border-ink-line pt-5 sm:grid-cols-2">
        <div>
          <span className="eyebrow text-ink-text-faint">Indicative cost per person</span>
          <p className="mt-1 font-display text-[22px] font-bold">
            ₹{header.estimatedCostPerPerson.min.toLocaleString("en-IN")} – ₹
            {header.estimatedCostPerPerson.max.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-text-faint">
            {header.estimatedCostPerPerson.note}
          </p>
        </div>
        <div>
          <span className="eyebrow text-ink-text-faint">On your dates</span>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-text-muted">
            {header.bestTimeNote}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ItineraryTail({ itinerary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div data-reveal className="print-block rounded-2xl border border-paper-line bg-card p-6">
        <h3 className="eyebrow text-accent-deep">Pack for this trip</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {itinerary.packing.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-paper-text-muted">
              <span className="mt-[3px] shrink-0 text-accent-deep">
                <CheckIcon size={13} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div data-reveal className="print-block rounded-2xl border border-warn/30 bg-warn/5 p-6">
        <h3 className="eyebrow text-paper-text">Worth knowing before you book</h3>
        <ul className="mt-3 flex flex-col gap-2">
          {itinerary.watchOuts.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-paper-text-muted">
              <span className="mt-[3px] shrink-0 text-warn">
                <AlertIcon size={13} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export const AI_DISCLAIMER =
  "This itinerary was drafted by AI from what you told us. Costs are indicative ranges, not quotes, and seasonal conditions change — a YaadiGo travel expert confirms availability and firm pricing before anything is booked.";
