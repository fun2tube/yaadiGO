import Link from "next/link";
import { SparkleIcon, ChevronIcon } from "./icons";

const SAMPLE_DAYS = [
  { day: 1, title: "Land in Srinagar, drift on the Dal", meta: "Srinagar · no long transfers" },
  { day: 2, title: "Gulmarg, and the Gondola gamble", meta: "Gulmarg · 1h 50m each way" },
  { day: 3, title: "Over the pass into Pahalgam", meta: "Pahalgam · 3h via Awantipora" },
];

export default function AiPlannerPromo() {
  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div data-reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/12 px-4 py-1.5 eyebrow text-accent">
            <SparkleIcon size={13} /> New — AI Trip Planner
          </span>
          <h2 className="mt-5 font-display text-[30px] font-black leading-[1.1] tracking-tight text-ink-text sm:text-[40px]">
            Get a full day-by-day itinerary before you talk to anyone.
          </h2>
          <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed text-ink-text-muted">
            Tell it where, when, how long and who&apos;s coming. It writes the whole trip — real
            places, real transfer times, an honest read on your dates, and an indicative cost
            range. Don&apos;t like day four? Rewrite just day four.
          </p>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-ink-text-faint">
            Then a YaadiGo travel expert prices it for real. The AI drafts; a human is still the
            one who books it.
          </p>
          <Link
            href="/plan"
            className="group mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[14.5px] font-bold text-white shadow-lg shadow-accent/25 transition-transform hover:scale-[1.04]"
          >
            <SparkleIcon size={16} /> Build an itinerary — free
            <ChevronIcon size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* A still of what the planner produces. Decorative, so it is hidden
            from assistive tech — the real thing is one click away. */}
        <div
          data-reveal
          style={{ "--reveal-delay": "120ms" }}
          aria-hidden="true"
          className="rounded-2xl border border-ink-line bg-ink-soft/70 p-5 backdrop-blur sm:p-6"
        >
          <div className="flex items-center gap-2 border-b border-ink-line pb-4">
            <span className="rounded-md bg-accent px-2 py-0.5 eyebrow text-white">
              6 days
            </span>
            <span className="eyebrow text-ink-text-faint">
              Kashmir
            </span>
          </div>
          <p className="mt-4 font-display text-[19px] font-bold text-ink-text">
            Slow Days in the Kashmir Valley
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {SAMPLE_DAYS.map((d) => (
              <div key={d.day} className="flex gap-3.5 rounded-xl bg-ink/50 p-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[12px] font-black text-accent">
                  {d.day}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-ink-text">{d.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-text-faint">{d.meta}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-3.5 rounded-xl bg-ink/50 p-3.5 opacity-50">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-[12px] font-black text-accent">
                4
              </span>
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 w-3/4 rounded bg-ink-line-strong" />
                <div className="h-2 w-1/2 rounded bg-ink-line" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
