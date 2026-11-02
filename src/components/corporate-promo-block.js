import Link from "next/link";
import { PlaneIcon, UsersIcon, CarIcon, MapIcon, ReceiptIcon, ShieldIcon, ChevronIcon } from "./icons";

const SERVICES = [
  { icon: PlaneIcon, title: "Flights & Hotels", detail: "Corporate rates via our myBiz partner network." },
  { icon: UsersIcon, title: "Dedicated Desk", detail: "A named executive — not a call centre." },
  { icon: CarIcon, title: "Ground Transport", detail: "Cabs and transfers across every trip." },
  { icon: MapIcon, title: "MICE & Offsites", detail: "Fixed-price offsite packages, our own inventory." },
  { icon: ReceiptIcon, title: "Prepaid Wallet & GST Invoicing", detail: "Recharge a wallet; an AI agent reconciles every invoice." },
  { icon: ShieldIcon, title: "Visa & Insurance", detail: "Arranged through trusted partners." },
];

export default function CorporatePromoBlock() {
  return (
    <section className="bg-ink">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent">
              Corporate Travel Desk
            </span>
            <h2 className="mt-2 font-display text-[28px] font-medium leading-[1.25] text-ink-text sm:text-[32px]">
              A dedicated travel desk — not a call centre, not a self-serve portal.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-text-faint">
              A named executive, GST-compliant billing, a prepaid wallet, and
              our own group-tour inventory for offsites — built for companies
              that need business travel handled properly.
            </p>
          </div>
          <Link
            href="/corporate-travel"
            className="flex items-center gap-2 rounded-full border border-ink-line-strong px-5 py-3 text-[14px] font-semibold text-ink-text"
          >
            Explore the Corporate Travel Desk <ChevronIcon size={15} />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div
              data-reveal
              key={s.title}
              className="flex gap-3.5 rounded-xl border border-ink-line bg-ink-soft p-5"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <s.icon size={18} />
              </span>
              <div>
                <h3 className="text-[14.5px] font-semibold text-ink-text">{s.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-text-faint">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
