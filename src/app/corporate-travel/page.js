import Link from "next/link";
import { buildFor } from "@/components/builder/page-shell";
import Editable from "@/components/cms/editable";
import SiteNav from "@/components/site-nav";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { PlaneIcon, UsersIcon, CarIcon, MapIcon, ReceiptIcon, ShieldIcon, ChevronIcon, ClockIcon, WalletIcon, RobotIcon } from "@/components/icons";

export const metadata = {
  title: "Corporate Travel",
  description:
    "A named travel executive, a prepaid wallet instead of a credit application, an AI finance agent for invoicing and GST reconciliation, and fixed-price offsite packages — see the full For Corporate page.",
  alternates: { canonical: "/corporate-travel" },
};

const SERVICES = [
  {
    icon: MapIcon,
    title: "MICE & Corporate Offsites",
    detail:
      "Fixed-price offsite packages by team size and budget — a 2N/3D team offsite, a sales-kickoff format, an adventure offsite — priced up front instead of a three-week RFP, because we run this inventory ourselves for Group Tours too.",
  },
  {
    icon: PlaneIcon,
    title: "Flights & Hotels Booking",
    detail: "Corporate rates through our myBiz partner account, plus EaseMyTrip, Yatra and Booking.com for coverage across routes.",
  },
  {
    icon: UsersIcon,
    title: "Dedicated Travel Desk",
    detail: "One named point of contact backed by a desk team — 24-hour turnaround, support 10 AM–7 PM plus 24×7 for genuine emergencies.",
  },
  {
    icon: CarIcon,
    title: "Ground Transport & Cabs",
    detail: "Airport transfers and local cabs arranged as part of the same booking, not a separate vendor to chase.",
  },
  {
    icon: WalletIcon,
    title: "Prepaid Wallet — No Credit Application",
    detail: "You recharge a wallet and confirmed bookings draw down against it. No credit application, no approval committee, and the balance stays your money until a booking is made.",
  },
  {
    icon: RobotIcon,
    title: "AI Finance Agent",
    detail:
      "Collects every vendor invoice, checks the GSTIN against your registered entity, reconciles against GSTR-2B, and flags anything that would leak input tax credit — while the vendor can still correct it. A human reviews everything it raises.",
  },
  {
    icon: ShieldIcon,
    title: "Visa & Travel Insurance",
    detail: "Arranged through our partners — we handle the paperwork, we don't claim in-house processing we don't have.",
  },
];

const STATS = [
  { label: "Turnaround on a booking request", value: "24 hours" },
  { label: "Support window", value: "10 AM–7 PM + 24×7 emergency" },
  { label: "Credit applications", value: "None" },
  { label: "Minimum monthly bookings", value: "None" },
];

export default async function CorporateTravelPromoPage() {
  // A page built in the admin wins over the one below. Nothing published means
  // exactly the page in git — see components/builder/page-shell.jsx.
  const built = await buildFor("/corporate-travel");
  if (built) return built;

  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <section className="bg-ink">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Editable id="corporate.eyebrow" as="span" className="text-xs font-bold uppercase tracking-[0.13em] text-accent">
              For Corporate
            </Editable>
            <Editable id="corporate.heading" as="h1" className="mt-2 max-w-2xl font-display text-[32px] font-medium leading-[1.2] text-ink-text sm:text-[42px]">
              A named executive handles your bookings. Finance gets a clean invoice. Nobody chases anybody.
            </Editable>
            <Editable id="corporate.most-corporate-travel-platforms-want" as="p" multiline className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-text-faint">
              Most corporate travel platforms want a minimum booking volume
              before they&apos;ll take you on. We don&apos;t gate access that
              way — a company doing eight trips a month gets the same desk, the
              same billing discipline, and the same 24-hour turnaround as one
              doing eighty.
            </Editable>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/corporate"
                className="flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[14.5px] font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                See For Corporate <ChevronIcon size={15} />
              </a>
              <a
                href="mailto:corporate@yaadigo.com"
                className="flex items-center gap-2 rounded-full border border-ink-line-strong px-6 py-3.5 text-[14.5px] font-semibold text-ink-text"
              >
                Talk to a Travel Desk Specialist
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-paper-line bg-paper-dim">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4 sm:px-10">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 font-display text-[18px] font-medium text-paper-text">
                  {s.label === "Turnaround on a booking request" && <ClockIcon size={15} />}
                  {s.value}
                </span>
                <span className="text-[12px] leading-snug text-paper-text-faint">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <Editable id="corporate.what-apos-s-handled" as="h2" className="font-display text-[26px] font-medium text-paper-text">
              What&apos;s handled, in plain terms
            </Editable>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="flex flex-col gap-3 rounded-xl border border-paper-line bg-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent-deep">
                  <s.icon size={18} />
                </span>
                <h3 className="text-[14.5px] font-semibold text-paper-text">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-paper-text-muted">{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-ink">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
              <div>
                <Editable id="corporate.the-gst-reconciliation-problem" as="h2" className="font-display text-[24px] font-medium text-ink-text">
              The GST reconciliation problem, handed to an agent
            </Editable>
                <Editable id="corporate.a-lot-of-corporate-travel" as="p" multiline className="mt-3 text-[14.5px] leading-relaxed text-ink-text-faint">
                  A lot of corporate travel invoicing quietly loses input tax
                  credit — vendor invoices that don&apos;t qualify, formats
                  finance can&apos;t reconcile against actual bookings. It is
                  high-volume, repetitive work, so it is the first thing a busy
                  finance team drops. An AI agent runs it on every booking
                  instead: collect the invoice, validate the GSTIN, reconcile
                  against GSTR-2B, and flag a bad invoice while the vendor can
                  still fix it.
            </Editable>
              </div>
              <div>
                <Editable id="corporate.travel-that-doesn-apos" as="h2" className="font-display text-[24px] font-medium text-ink-text">
              Travel that doesn&apos;t fit an employee login
            </Editable>
                <Editable id="corporate.guest-travel-candidate-interviews-contractor" as="p" multiline className="mt-3 text-[14.5px] leading-relaxed text-ink-text-faint">
                  Guest travel, candidate interviews, contractor trips — none
                  of it maps to a profile on a self-serve booking platform,
                  so it usually falls to whoever&apos;s free that week. We book it
                  as its own line, not a workaround squeezed into &quot;Flights
                  &amp; Hotels.&quot;
            </Editable>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <div className="rounded-2xl border border-paper-line bg-paper-dim p-8 sm:p-10">
            <Editable id="corporate.ready-to-see-how" as="h2" className="font-display text-[22px] font-medium text-paper-text">
              Ready to see how this works for your team?
            </Editable>
            <Editable id="corporate.the-full-process-wallet-terms" as="p" multiline className="mt-2 max-w-lg text-[14px] leading-relaxed text-paper-text-muted">
              The full process, wallet terms, and proposal form live on
              our For Corporate page — that&apos;s where a discovery call gets
              booked.
            </Editable>
            <Link
              href="/corporate"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14.5px] font-semibold text-ink-text transition-transform hover:scale-[1.03]"
            >
              Go to For Corporate <ChevronIcon size={15} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
