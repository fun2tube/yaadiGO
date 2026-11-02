import Link from "next/link";
import { ChevronIcon } from "./icons";

const STEPS = [
  { n: "1", title: "Tell us your trip", detail: "Destination, dates, group size, budget band." },
  { n: "2", title: "We design it — free", detail: "A draft itinerary back within hours, not days." },
  { n: "3", title: "Refine together", detail: "Swap hotels, add a day, adjust the pace." },
  { n: "4", title: "Book", detail: "Confirm and we handle everything from there." },
];

export default function CustomizedTourCallout() {
  return (
    <section className="bg-paper-dim">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:flex-row lg:items-center lg:gap-16">
        <div className="flex-1">
          <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
            Customized Tours
          </span>
          <h2 className="mt-2 font-display text-[28px] font-medium leading-[1.25] text-paper-text sm:text-[32px]">
            Tell us your dates & budget. We&apos;ll design the trip.
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper-text-muted">
            No fixed itinerary you have to fit into — a custom plan built
            around what you actually want, refined with you before you pay
            anything.
          </p>
          <Link
            href="/customized-tours#enquire"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-ink-text transition-transform hover:scale-[1.03]"
          >
            Start Planning <ChevronIcon size={15} />
          </Link>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          {STEPS.map((step) => (
            <div
              data-reveal
              key={step.n}
              className="rounded-xl border border-paper-line bg-card p-5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 font-display text-[13px] font-semibold text-accent-deep">
                {step.n}
              </span>
              <h3 className="mt-3 text-[14.5px] font-semibold text-paper-text">
                {step.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-paper-text-muted">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
