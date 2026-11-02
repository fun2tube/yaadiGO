import Reveal from "@/components/reveal";
import Reel, { Panel } from "@/components/reel";
import NeuralField from "@/components/neural-field";
import CountUp from "@/components/count-up";
import CorporateNav from "@/components/corporate/corporate-nav";
import CorporateLeadForm from "@/components/corporate/corporate-lead-form";
import SiteFooter from "@/components/site-footer";
import { CONTACT, SITE_URL, quickEnquiryHref } from "@/lib/site";
import {
  PlaneIcon,
  UsersIcon,
  CarIcon,
  MapIcon,
  ShieldIcon,
  WalletIcon,
  RobotIcon,
  ChevronIcon,
  CheckIcon,
  SparkleIcon,
  WhatsAppIcon,
  ChatIcon,
  AlertIcon,
} from "@/components/icons";

// Served at corporate.yaadigo.com via src/proxy.js, and reachable at
// /corporate on the main domain.
export const metadata = {
  title: "Corporate Travel Desk — GST-Compliant Business Travel, No Minimum Volume",
  description:
    "A named travel executive, 24-hour booking turnaround, a prepaid wallet instead of a credit application, and an AI finance agent that validates every invoice, reconciles GSTR-2B and tracks input tax credit. No minimum monthly booking volume to qualify.",
  alternates: { canonical: "/corporate" },
  openGraph: {
    type: "website",
    title: "YaadiGo Corporate Travel Desk",
    description:
      "Prepaid wallet, no credit application. An AI finance agent handles invoicing, GST compliance and reconciliation. No minimum monthly volume to qualify.",
  },
};

const PANEL_COUNT = 7;

const SERVICES = [
  {
    Icon: PlaneIcon,
    title: "Flights & hotels",
    detail:
      "Corporate rates through our myBiz partner account, plus EaseMyTrip, Yatra and Booking.com so route and city coverage never comes down to one supplier's inventory.",
  },
  {
    Icon: UsersIcon,
    title: "A dedicated desk",
    detail:
      "One named travel executive who knows your policy, backed by a desk team so nothing stalls when that person is on leave.",
  },
  {
    Icon: WalletIcon,
    title: "Prepaid wallet",
    detail:
      "Recharge a wallet; bookings draw down against it. No credit application, no approval committee, no personal guarantee — and the balance is your money until a booking is confirmed.",
  },
  {
    Icon: RobotIcon,
    title: "AI finance agent",
    detail:
      "Collects every vendor invoice, checks the GSTIN against your registered entity, reconciles against GSTR-2B, and flags anything that would leak input tax credit — before it is filed, not after.",
  },
  {
    Icon: MapIcon,
    title: "MICE & offsites",
    detail:
      "Fixed-price offsite packages by team size and budget band, quoted same-day because we already run this inventory for our own group tours.",
  },
  {
    Icon: CarIcon,
    title: "Ground transport",
    detail:
      "Airport transfers and local cabs booked as part of the same trip, on the same invoice, not a separate vendor for finance to chase.",
  },
  {
    Icon: ShieldIcon,
    title: "Visa & insurance",
    detail:
      "Arranged through our partners — we handle the paperwork and the follow-ups. We don't claim in-house processing we don't have.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Discovery call",
    detail:
      "30 minutes. Who travels, how often, what your approval chain looks like, and where the current process actually hurts.",
  },
  {
    n: "02",
    title: "Terms & SLA in writing",
    detail:
      "Wallet terms, turnaround commitments, escalation path and your named executive — agreed in writing before a single booking is made.",
  },
  {
    n: "03",
    title: "Fund the wallet",
    detail:
      "We load your travel policy, GSTIN, cost centres and approver list, and you make a first recharge. Your team books by email, phone or WhatsApp — no new app to roll out.",
  },
  {
    n: "04",
    title: "Run and report",
    detail:
      "Bookings inside 24 hours. The AI agent reconciles every invoice as it lands and produces your monthly statement and quarterly ITC summary; a human reviews anything it flags before it reaches you.",
  },
];

// What the AI finance agent does on every booking, in the order it happens.
const AGENT_STEPS = [
  ["Collects", "Pulls the vendor invoice for every booking as it is raised — airline, hotel, cab, visa."],
  ["Validates", "Checks the GSTIN, the legal entity name and the invoice format against your registered details."],
  ["Reconciles", "Matches each invoice to the booking and to your GSTR-2B, and to the wallet deduction."],
  ["Flags", "Raises anything that would leak input tax credit, while it can still be corrected with the vendor."],
  ["Reports", "Produces the monthly statement per cost centre and the quarterly ITC summary."],
];

const WALLET_POINTS = [
  "No credit application, no approval committee, no personal guarantee",
  "Balance is your money until a booking is confirmed, and it doesn't expire",
  "Low-balance alerts before it runs out; bookings pause rather than going on credit",
  "Every recharge and deduction visible on the statement, per cost centre",
];

const PAIN = [
  {
    problem: "Input tax credit quietly leaks",
    fix: "An AI finance agent checks every vendor invoice against your GSTIN and your GSTR-2B, and flags a bad invoice while the vendor can still fix it — not at year end when it is already lost.",
  },
  {
    problem: "Guest and candidate travel fits nowhere",
    fix: "Interview candidates, contractors and guest travellers get booked as their own line, not squeezed into an employee's login.",
  },
  {
    problem: "Credit applications take weeks",
    fix: "There isn't one. Recharge a wallet and start booking — no minimum monthly volume, no approval committee, and eight trips a month gets the same desk as eighty.",
  },
  {
    problem: "Nobody answers at 11pm",
    fix: "Support 10 AM–7 PM for everyday requests, plus 24×7 cover for genuine emergencies on a live trip.",
  },
];

export default function CorporateLandingPage() {
  const whatsapp = quickEnquiryHref(
    "Hi YaadiGo — I'd like to talk about a corporate travel account."
  );
  const isWhatsApp = whatsapp.startsWith("http");

  return (
    <>
      <Reveal />
      <Reel panelCount={PANEL_COUNT} />
      <CorporateNav />

      <main>
        {/* 1 — Hero ------------------------------------------------------ */}
        <Panel tone="ink" className="relative overflow-hidden">
          <NeuralField density={1.15} />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/12 px-4 py-1.5 eyebrow text-accent">
              Corporate Travel Desk
            </span>
            <h1 className="mt-6 max-w-3xl font-display text-[36px] font-black leading-[1.05] tracking-tight text-ink-text sm:text-[58px]">
              A named executive books it. Finance gets a{" "}
              <span className="text-accent-bright">
                clean invoice
              </span>
              . Nobody chases anybody.
            </h1>
            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-text-muted sm:text-[17px]">
              Most corporate travel platforms want a minimum booking volume, or a credit
              application, before they&apos;ll take you on. We don&apos;t gate access that way
              — you recharge a wallet and start booking, and an AI finance agent keeps the
              invoicing, GST and reconciliation straight from day one.
            </p>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <a
                href="#corporate-enquiry"
                className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-[15px] font-bold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98] sm:py-3.5"
              >
                Get wallet terms & an SLA <ChevronIcon size={15} />
              </a>
              <a
                href={whatsapp}
                {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center justify-center gap-2 rounded-full border border-ink-line-strong px-6 py-4 text-[15px] font-bold text-ink-text transition-colors hover:border-accent/60 sm:py-3.5"
              >
                {isWhatsApp ? <WhatsAppIcon size={17} /> : <ChatIcon size={17} />}
                {isWhatsApp ? "WhatsApp the desk" : "Quick enquiry"}
              </a>
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-ink-line pt-7 sm:grid-cols-4">
              {[
                { value: 24, suffix: "h", label: "Booking turnaround" },
                { value: 0, suffix: "", label: "Credit applications" },
                { value: 0, suffix: "", label: "Minimum monthly volume" },
                { value: 24, suffix: "×7", label: "Emergency cover" },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="font-display text-[24px] font-black text-ink-text sm:text-[28px]">
                    <CountUp value={s.value} suffix={s.suffix} />
                  </dt>
                  <dd className="mt-0.5 text-[11.5px] leading-snug text-ink-text-faint">
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>

        {/* 2 — The problems ---------------------------------------------- */}
        <Panel tone="paper">
          <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
            <span
              data-reveal
              className="eyebrow text-accent-deep"
            >
              What this actually fixes
            </span>
            <h2
              data-reveal
              className="mt-2 max-w-2xl font-display text-[28px] font-black leading-[1.1] tracking-tight text-paper-text sm:text-[40px]"
            >
              Four things that quietly cost you money every quarter
            </h2>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {PAIN.map((item, i) => (
                <div
                  key={item.problem}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 80}ms` }}
                  className="rounded-2xl border border-paper-line bg-card p-5"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 text-warn">
                      <AlertIcon size={15} />
                    </span>
                    <h3 className="text-[14.5px] font-bold text-paper-text">{item.problem}</h3>
                  </div>
                  <div className="mt-3 flex items-start gap-2.5 border-t border-paper-line pt-3">
                    <span className="mt-0.5 shrink-0 text-accent-deep">
                      <CheckIcon size={15} />
                    </span>
                    <p className="text-[13px] leading-relaxed text-paper-text-muted">{item.fix}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* 3 — Services --------------------------------------------------- */}
        <Panel id="services" tone="dim">
          <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
            <span
              data-reveal
              className="eyebrow text-accent-deep"
            >
              Services
            </span>
            <h2
              data-reveal
              className="mt-2 font-display text-[28px] font-black leading-[1.1] tracking-tight text-paper-text sm:text-[40px]"
            >
              Everything the desk handles
            </h2>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map(({ Icon, title, detail }, i) => (
                <div
                  key={title}
                  data-reveal
                  style={{ "--reveal-delay": `${Math.min(i, 5) * 70}ms` }}
                  className="rounded-2xl border border-paper-line bg-card p-5 transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg hover:shadow-ink/5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent-deep">
                    <Icon size={19} />
                  </span>
                  <h3 className="mt-3.5 text-[14.5px] font-bold text-paper-text">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-paper-text-muted">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* 4 — How it works ----------------------------------------------- */}
        <Panel id="how" tone="ink" className="relative overflow-hidden">
          <NeuralField density={0.7} />
          <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
            <span
              data-reveal
              className="eyebrow text-accent"
            >
              How it works
            </span>
            <h2
              data-reveal
              className="mt-2 font-display text-[28px] font-black leading-[1.1] tracking-tight text-ink-text sm:text-[40px]"
            >
              From first call to first booking in a week
            </h2>

            <ol className="mt-9 flex flex-col gap-0">
              {STEPS.map((step, i) => (
                <li
                  key={step.n}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 90}ms` }}
                  className="relative flex gap-5 pb-7 last:pb-0"
                >
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-ink-line-strong"
                    />
                  )}
                  <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-ink text-[12px] font-black text-accent">
                    {step.n}
                  </span>
                  <div className="pt-1.5">
                    <h3 className="text-[15.5px] font-bold text-ink-text">{step.title}</h3>
                    <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-ink-text-muted">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Panel>

        {/* 5 — Wallet + AI finance agent -------------------------------- */}
        <Panel id="billing" tone="paper">
          <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
            <span
              data-reveal
              className="eyebrow text-accent-deep"
            >
              Wallet &amp; compliance
            </span>
            <h2
              data-reveal
              className="mt-2 max-w-3xl font-display text-[28px] font-black leading-[1.1] tracking-tight text-paper-text sm:text-[40px]"
            >
              Recharge a wallet. An AI agent handles the rest of the paperwork.
            </h2>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {/* Wallet */}
              <div
                data-reveal
                className="flex flex-col rounded-2xl border border-paper-line bg-card p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent-deep">
                    <WalletIcon size={19} />
                  </span>
                  <h3 className="font-display text-[19px] font-black text-paper-text">
                    The corporate wallet
                  </h3>
                </div>
                <p className="mt-3.5 text-[14px] leading-relaxed text-paper-text-muted">
                  You recharge a wallet; confirmed bookings draw down against the balance. That is
                  the whole mechanism — no credit application, no approval committee, and no
                  waiting on a finance decision before your first trip.
                </p>

                {/* Illustrative balance strip. Decorative: the real figures
                    live in the account statement, not on a marketing page. */}
                <div
                  aria-hidden="true"
                  className="mt-5 rounded-xl border border-paper-line bg-paper-dim p-4"
                >
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="eyebrow text-paper-text-faint">
                        Wallet balance
                      </span>
                      <p className="font-display text-[24px] font-black text-paper-text">
                        ₹4,20,000
                      </p>
                    </div>
                    <span className="rounded-md bg-accent/15 px-2 py-1 eyebrow text-accent-deep">
                      Healthy
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-line-strong">
                    <div className="h-full w-[68%] rounded-full bg-accent" />
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-paper-line pt-3">
                    {[
                      ["Recharge", "+ ₹5,00,000", "text-accent-deep"],
                      ["BLR → DEL, 2 pax", "− ₹41,800", "text-paper-text-muted"],
                      ["Hotel, Gurugram, 3N", "− ₹38,200", "text-paper-text-muted"],
                    ].map(([label, amount, tone]) => (
                      <div key={label} className="flex justify-between text-[12.5px]">
                        <span className="text-paper-text-muted">{label}</span>
                        <span className={`font-bold tabular-nums ${tone}`}>{amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <ul className="mt-5 flex flex-col gap-2.5">
                  {WALLET_POINTS.map((point) => (
                    <li
                      key={point}
                      className="flex gap-2.5 text-[13.5px] leading-relaxed text-paper-text-muted"
                    >
                      <span className="mt-0.5 shrink-0 text-accent-deep">
                        <CheckIcon size={14} />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI finance agent */}
              <div
                data-reveal
                style={{ "--reveal-delay": "110ms" }}
                className="flex flex-col rounded-2xl border border-paper-line bg-card p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent-deep">
                    <RobotIcon size={19} />
                  </span>
                  <h3 className="font-display text-[19px] font-black text-paper-text">
                    The AI finance agent
                  </h3>
                </div>
                <p className="mt-3.5 text-[14px] leading-relaxed text-paper-text-muted">
                  Travel invoicing is high-volume, repetitive and unforgiving — exactly the
                  work that gets skipped when a finance team is busy, and exactly where input tax
                  credit leaks. An agent runs it on every booking, in order:
                </p>

                <ol className="mt-5 flex flex-col gap-0">
                  {AGENT_STEPS.map(([title, detail], i) => (
                    <li key={title} className="relative flex gap-4 pb-4 last:pb-0">
                      {i < AGENT_STEPS.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-paper-line-strong"
                        />
                      )}
                      <span className="relative z-10 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-accent/40 bg-card text-[11px] font-black text-accent-deep">
                        {i + 1}
                      </span>
                      <div>
                        <h4 className="text-[13.5px] font-black text-paper-text">{title}</h4>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-paper-text-muted">
                          {detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <p className="mt-5 rounded-xl border border-paper-line bg-paper-dim p-4 text-[12.5px] leading-relaxed text-paper-text-muted">
                  <strong className="font-bold text-paper-text">A human still signs off.</strong>{" "}
                  The agent does the matching and the flagging; anything it raises is reviewed by
                  your named executive before it reaches you, and nothing is filed on your behalf
                  without your finance team seeing it.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        {/* 6 — MICE ------------------------------------------------------- */}
        <Panel id="mice" tone="dim">
          <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
            <span
              data-reveal
              className="eyebrow text-accent-deep"
            >
              MICE & offsites
            </span>
            <h2
              data-reveal
              className="mt-2 max-w-2xl font-display text-[28px] font-black leading-[1.1] tracking-tight text-paper-text sm:text-[40px]"
            >
              Offsites quoted same-day, at a fixed price
            </h2>
            <p
              data-reveal
              className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-paper-text-muted"
            >
              The biggest time sink in offsite planning is the open-ended brief. Give us team size,
              a budget band per person, and a theme — the quote comes back the same day, because
              the vendor relationships behind it are the ones we already run our group tours on.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Relaxed / bonding", "2N/3D, one resort base, low-effort activities"],
                ["High-energy", "Adventure day, evening event, tighter schedule"],
                ["Working offsite", "Sessions room, AV, structured agenda blocks"],
              ].map(([title, detail]) => (
                <div
                  key={title}
                  data-reveal
                  className="rounded-2xl border border-paper-line bg-card p-5"
                >
                  <h3 className="text-[14.5px] font-bold text-paper-text">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-paper-text-muted">
                    {detail}
                  </p>
                </div>
              ))}
            </div>

            <div
              data-reveal
              className="mt-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/8 p-5"
            >
              <span className="mt-0.5 shrink-0 text-accent-deep">
                <SparkleIcon size={17} />
              </span>
              <p className="text-[13.5px] leading-relaxed text-paper-text">
                <strong className="font-bold">Planning one right now?</strong> Use the AI planner to
                draft the itinerary, then send it to the desk to be priced.{" "}
                <a href={`${SITE_URL}/plan`} className="font-bold text-accent-deep underline">
                  Open the planner →
                </a>
              </p>
            </div>
          </div>
        </Panel>

        {/* 7 — Lead form -------------------------------------------------- */}
        <Panel tone="ink">
          <div className="mx-auto grid w-full max-w-6xl gap-9 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
            <div data-reveal>
              <h2 className="font-display text-[30px] font-black leading-[1.08] tracking-tight text-ink-text sm:text-[42px]">
                Start with a 30-minute call.
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-text-muted">
                You&apos;ll get wallet terms, a proposed SLA and a named executive in writing
                before you commit to anything.
              </p>

              <ul className="mt-7 flex flex-col gap-3">
                {[
                  "No minimum monthly booking volume",
                  "No platform licence or per-seat fee",
                  "Your travel policy loaded during onboarding",
                  "Booking by email, phone or WhatsApp — no new app",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] text-ink-text-muted">
                    <span className="mt-0.5 shrink-0 text-accent">
                      <CheckIcon size={15} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-7 border-t border-ink-line pt-5">
                <span className="eyebrow text-ink-text-faint">
                  Or reach the desk directly
                </span>
                <a
                  href={`mailto:${CONTACT.corporateEmail}`}
                  className="mt-1.5 block text-[15px] font-bold text-accent"
                >
                  {CONTACT.corporateEmail}
                </a>
                {CONTACT.phone && (
                  <a
                    href={`tel:${CONTACT.phoneHref ?? CONTACT.phone}`}
                    className="mt-1 block text-[15px] font-bold text-ink-text"
                  >
                    {CONTACT.phone}
                  </a>
                )}
              </div>
            </div>

            <div data-reveal style={{ "--reveal-delay": "120ms" }}>
              <CorporateLeadForm />
            </div>
          </div>
        </Panel>
      </main>

      <SiteFooter />
    </>
  );
}
