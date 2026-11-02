import CountUp from "./count-up";

const STATS = [
  { value: 10, suffix: "+", label: "years planning trips & travel desks" },
  { value: 40, suffix: "+", label: "destinations across group & custom tours" },
  { value: 24, suffix: "h", label: "turnaround on a corporate booking request" },
];

const PARTNERS = ["MakeMyTrip / myBiz", "EaseMyTrip", "Yatra", "Booking.com"];

export default function TrustStrip() {
  return (
    <section className="border-b border-paper-line bg-paper-dim">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="flex flex-wrap gap-x-10 gap-y-5">
          {STATS.map((s, i) => (
            <div key={s.label} data-reveal style={{ "--reveal-delay": `${i * 90}ms` }}>
              <span className="font-display text-[28px] font-black tracking-tight text-paper-text">
                <CountUp value={s.value} suffix={s.suffix} />
              </span>
              <span className="mt-0.5 block max-w-[170px] text-[12.5px] leading-snug text-paper-text-faint">
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div data-reveal className="flex flex-col gap-2">
          <span className="eyebrow text-paper-text-faint">
            Booking partner network
          </span>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] font-semibold text-paper-text-muted">
            {PARTNERS.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
