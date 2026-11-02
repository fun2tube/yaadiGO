import Link from "next/link";
import { buildFor } from "@/components/builder/page-shell";
import Editable from "@/components/cms/editable";
import SiteNav from "@/components/site-nav";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { ChevronIcon } from "@/components/icons";
import {
  ORG_LEGAL_NAME,
  REGISTRATION,
  CORPORATE_URL,
  formattedAddress,
} from "@/lib/site";

export const metadata = {
  title: "About YaadiGo — Group Tours & Corporate Travel",
  description:
    "YaadiGo Networks Pvt Ltd runs fixed-departure group tours, customized trips and a Corporate Travel Desk. How each works, and what we do not claim.",
  alternates: { canonical: "/about" },
};

const DIVISIONS = [
  {
    href: "/group-tours",
    title: "Group Tours",
    detail:
      "Fixed departures on set dates with a capped group size, usually 10–16 travellers. Inclusions and exclusions are written out before you pay, because the argument about what was covered otherwise happens after the trip.",
  },
  {
    href: "/customized-tours",
    title: "Customized Tours",
    detail:
      "You give us destination, dates, group size and a budget band; we come back with a full draft itinerary, free, and refine it with you for as many rounds as it takes. Nothing is payable until you approve it.",
  },
  {
    href: CORPORATE_URL,
    title: "For Corporate",
    detail:
      "A named travel executive, a prepaid wallet instead of a credit application, and an AI finance agent that validates and reconciles every invoice. No minimum monthly booking volume to qualify.",
  },
];

// `id` is the page editor's stable key — see the same pattern in lib/proof.js.
const PRINCIPLES = [
  {
    id: "promise",
    title: "The itinerary is the promise",
    detail:
      "If an activity depends on weather, a permit or a seasonal opening, the itinerary says so and the price doesn't assume it will happen. Gondola Phase 2 closing is a known risk, not a surprise we discover together at the ticket counter.",
  },
  {
    id: "broker",
    title: "We say what we broker and what we run",
    detail:
      "Visas and travel insurance are arranged through partners — we handle the paperwork, we don't claim in-house processing we don't have. Flights and hotels come through our myBiz partner account alongside EaseMyTrip, Yatra and Booking.com.",
  },
  {
    id: "finance",
    title: "Finance shouldn't have to chase us",
    detail:
      "Corporate invoices are issued against the GSTIN given at booking time, not reconstructed afterwards. An AI agent reconciles every one of them against GSTR-2B and flags leakage while it is still fixable — and a human reviews what it raises before finance sees it.",
  },
];

export default async function AboutPage() {
  // A page built in the admin wins over the one below. Nothing published means
  // exactly the page in git — see components/builder/page-shell.jsx.
  const built = await buildFor("/about");
  if (built) return built;

  const address = formattedAddress();

  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <section className="bg-paper-dim">
          <div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 sm:py-16">
            <Editable id="about.eyebrow" as="span" className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
              About
            </Editable>
            <h1 className="mt-2 font-display text-[32px] font-medium leading-[1.2] text-paper-text sm:text-[40px]">
              {ORG_LEGAL_NAME}
            </h1>
            <Editable id="about.intro" as="p" multiline className="mt-5 text-[15px] leading-relaxed text-paper-text-muted">
              YaadiGo runs three things under one roof: fixed-departure group
              tours, fully customized trip planning, and a Corporate Travel
              Desk for companies that need business travel handled properly.
              The same vendor relationships and the same desk sit behind all
              three, which is why a company offsite can be quoted at a fixed
              price the same day instead of starting a three-week RFP.
            </Editable>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-14 sm:px-10">
          <Editable id="about.divisions.heading" as="h2" className="font-display text-[24px] font-medium text-paper-text">
            What we actually do
          </Editable>
          <div className="mt-6 flex flex-col gap-4">
            {DIVISIONS.map((division) => (
              <Link
                key={division.href}
                href={division.href}
                className="group rounded-xl border border-paper-line bg-card p-6 transition-colors hover:border-paper-line-strong"
              >
                <span className="flex items-center gap-1.5 text-[16px] font-semibold text-paper-text">
                  {/* The href without its leading slash — a stable key that
                      reads cleanly: about.division.group-tours.title */}
                  <Editable id={`about.division.${division.href.slice(1)}.title`} as="span">
                    {division.title}
                  </Editable>
                  <ChevronIcon
                    size={14}
                    className="text-paper-text-faint transition-transform group-hover:translate-x-1"
                  />
                </span>
                <Editable
                  id={`about.division.${division.href.slice(1)}.detail`}
                  as="p"
                  multiline
                  className="mt-2 text-[14px] leading-relaxed text-paper-text-muted"
                >
                  {division.detail}
                </Editable>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-ink">
          <div className="mx-auto max-w-3xl px-6 py-14 sm:px-10 sm:py-16">
            <Editable id="about.principles.heading" as="h2" className="font-display text-[24px] font-medium text-ink-text">How we work</Editable>
            <div className="mt-6 flex flex-col gap-6">
              {PRINCIPLES.map((principle) => (
                <div key={principle.id}>
                  <Editable id={`about.principle.${principle.id}.title`} as="h3" className="text-[15px] font-semibold text-ink-text">{principle.title}</Editable>
                  <Editable id={`about.principle.${principle.id}.detail`} as="p" multiline className="mt-1.5 text-[14px] leading-relaxed text-ink-text-faint">
                    {principle.detail}
                  </Editable>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-14 sm:px-10 sm:py-16">
          <Editable id="about.company.heading" as="h2" className="font-display text-[24px] font-medium text-paper-text">Company details</Editable>
          {/* Registration numbers and the office address come from lib/site.js
              and appear here as soon as they are filled in. */}
          <dl className="mt-5 flex flex-col gap-4">
            <div>
              <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                Registered name
              </dt>
              <dd className="mt-0.5 text-[15px] text-paper-text">{ORG_LEGAL_NAME}</dd>
            </div>
            {address && (
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                  Registered office
                </dt>
                <dd className="mt-0.5 text-[15px] leading-relaxed text-paper-text">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {REGISTRATION.cin && (
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                  CIN
                </dt>
                <dd className="mt-0.5 text-[15px] text-paper-text">{REGISTRATION.cin}</dd>
              </div>
            )}
            {REGISTRATION.gstin && (
              <div>
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                  GSTIN
                </dt>
                <dd className="mt-0.5 text-[15px] text-paper-text">{REGISTRATION.gstin}</dd>
              </div>
            )}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-ink-text transition-transform hover:scale-[1.03]"
            >
              Talk to the travel desk
            </Link>
            <a
              href={CORPORATE_URL}
              className="rounded-full border border-paper-line-strong px-6 py-3 text-[14px] font-semibold text-paper-text"
            >
              For Corporate →
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
