import { ShieldIcon, ClockIcon, ReceiptIcon, MapIcon } from "./icons";

const POINTS = [
  { icon: ShieldIcon, title: "Registered entity", detail: "YaadiGo Networks Pvt Ltd — details on every invoice and in our footer." },
  { icon: ClockIcon, title: "Response times, stated as numbers", detail: "24-hour TAT on corporate requests, not \"fast and reliable.\"" },
  { icon: ReceiptIcon, title: "GST-compliant billing", detail: "Every corporate invoice is GST-assured, by default." },
  { icon: MapIcon, title: "Our own group-tour inventory", detail: "Offsites and group trips run on vendor relationships we already operate." },
];

export default function WhyYaadiGo() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
      <div className="max-w-xl">
        <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
          Why YaadiGo
        </span>
        <h2 className="mt-2 font-display text-[28px] font-medium text-paper-text sm:text-[32px]">
          The trust signals that actually matter
        </h2>
      </div>
      <div data-reveal className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map((p) => (
          <div key={p.title} className="flex flex-col gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent-deep">
              <p.icon size={19} />
            </span>
            <h3 className="text-[14.5px] font-semibold text-paper-text">{p.title}</h3>
            <p className="text-[13px] leading-relaxed text-paper-text-muted">{p.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
