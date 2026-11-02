import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import NeuralField from "@/components/neural-field";
import Planner from "@/components/planner/planner";
import { decodeTrip } from "@/lib/trip-link";
import { SparkleIcon } from "@/components/icons";

export const metadata = {
  title: "AI Trip Planner — Build a Day-by-Day Itinerary Free",
  description:
    "Describe your trip and get a full day-by-day itinerary in under a minute — real places, honest costs, seasonal warnings. Rewrite any day, then have a YaadiGo travel expert price it for real.",
  alternates: { canonical: "/plan" },
};

const PROOF = [
  { label: "Day-by-day", detail: "Morning, afternoon, evening — not a list of city names" },
  { label: "Honest about risk", detail: "Monsoon, permits, altitude and closures called out" },
  { label: "Redo any day", detail: "Don't like day 4? Rewrite just that one" },
  { label: "Then a human", detail: "A travel expert prices and checks it before you book" },
];

export default async function PlanPage({ searchParams }) {
  // A shared ?trip= link opens with the form already filled in.
  const { trip } = await searchParams;
  const initialTrip = typeof trip === "string" ? decodeTrip(trip) : null;

  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <section className="relative overflow-hidden bg-ink">
          <NeuralField density={1.2} />
          {/* Ambient glow — pure CSS, no image weight. */}
          <div className="relative mx-auto max-w-4xl px-6 py-16 text-center sm:px-10 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/12 px-4 py-1.5 eyebrow text-accent">
              <SparkleIcon size={13} /> AI Trip Planner
            </span>
            <h1 className="mt-5 font-display text-[34px] font-black leading-[1.08] tracking-tight text-ink-text sm:text-[52px]">
              Describe the trip.
              <br />
              Get the whole itinerary.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-text-muted">
              Not a list of places — a day-by-day plan with real transfer times, what to eat, where
              to base yourself, and an honest read on whether your dates actually work.
            </p>
          </div>
        </section>

        <section className="border-b border-paper-line bg-paper-dim">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-7 sm:grid-cols-4 sm:px-10">
            {PROOF.map((item) => (
              <div key={item.label} data-reveal>
                <span className="text-[12.5px] font-black uppercase tracking-[0.1em] text-accent-deep">
                  {item.label}
                </span>
                <p className="mt-1 text-[12.5px] leading-snug text-paper-text-muted">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
          <Planner initialTrip={initialTrip} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
