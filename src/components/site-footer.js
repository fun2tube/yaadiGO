import Link from "next/link";
import { getNavigation } from "@/lib/cms/navigation";
import { ChevronIcon, SparkleIcon, WhatsAppIcon, ChatIcon } from "./icons";
import NeuralField from "./neural-field";
import DeskStatus from "./desk-status";
import {
  ORG_LEGAL_NAME,
  CONTACT,
  CORPORATE_URL,
  REGISTRATION,
  SOCIAL,
  formattedAddress,
  quickEnquiryHref,
  whatsappLink,
} from "@/lib/site";

const COLUMNS = [
  {
    index: "01",
    title: "Travel",
    links: [
      { href: "/group-tours", label: "Group Tours" },
      { href: "/customized-tours", label: "Customized Tours" },
      { href: "/plan", label: "AI Trip Planner" },
    ],
  },
  {
    index: "02",
    title: "Business",
    links: [
      { href: "/corporate-travel", label: "Corporate Travel" },
      { href: CORPORATE_URL, label: "For Corporate" },
    ],
  },
  {
    index: "03",
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Journal" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

/**
 * Columns come from the CMS when somebody has edited them, and from COLUMNS
 * above when nobody has — the same fallback rule as the menu and every other
 * editable thing here.
 */
export default async function SiteFooter() {
  const { footer } = await getNavigation();
  const columns = footer?.length ? footer : COLUMNS;

  // Anything unset in lib/site.js is skipped rather than rendered as a
  // bracketed placeholder — see the TODOs there.
  const address = formattedAddress();
  const quickHref = quickEnquiryHref("Hi YaadiGo — I'd like help planning a trip.");
  const isWhatsApp = Boolean(whatsappLink(""));
  const socials = Object.entries(SOCIAL).filter(([, url]) => url);

  return (
    <footer className="relative overflow-hidden bg-ink">
      <NeuralField density={0.55} linkDistance={170} />

      <div className="relative mx-auto max-w-6xl px-6 pt-16 sm:px-10 sm:pt-20">
        {/* Closing CTA — the footer's job is one more chance to convert, so it
            leads rather than trailing behind a wall of links. */}
        <div
          data-reveal
          className="flex flex-col justify-between gap-7 border-b border-ink-line pb-12 lg:flex-row lg:items-end"
        >
          <div>
            <DeskStatus />
            <h2 className="mt-4 max-w-xl font-display text-[30px] font-bold leading-[1.1] tracking-tight text-ink-text sm:text-[44px]">
              Tell us where you want to go.
            </h2>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-text-muted">
              Same-day first response in business hours. A person replies — the AI just does the
              drafting.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <Link
              href="/plan"
              className="group flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[14.5px] font-bold text-white transition-transform hover:scale-[1.03]"
            >
              <SparkleIcon size={16} /> Build an itinerary
              <ChevronIcon size={14} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={quickHref}
              {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="flex items-center justify-center gap-2 rounded-xl border border-ink-line-strong px-6 py-3.5 text-[14.5px] font-bold text-ink-text transition-colors hover:border-accent"
            >
              {isWhatsApp ? <WhatsAppIcon size={16} /> : <ChatIcon size={16} />}
              {isWhatsApp ? "WhatsApp" : "Quick enquiry"}
            </a>
          </div>
        </div>

        {/* Link columns, indexed. */}
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title} data-reveal className="flex flex-col gap-4">
              <span className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-text-faint">
                <span className="text-accent-bright">{column.index}</span>
                {column.title}
              </span>
              <div className="flex flex-col items-start gap-2.5">
                {column.links.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      className="link-underline text-[14px] font-medium text-ink-text-muted transition-colors hover:text-ink-text"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="link-underline text-[14px] font-medium text-ink-text-muted transition-colors hover:text-ink-text"
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}

          <div data-reveal className="flex flex-col gap-4">
            <span className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-text-faint">
              <span className="text-accent-bright">04</span>
              Reach us
            </span>
            <div className="flex flex-col items-start gap-2.5">
              <a
                href={`mailto:${CONTACT.corporateEmail}`}
                className="link-underline text-[14px] font-medium text-ink-text-muted transition-colors hover:text-ink-text"
              >
                {CONTACT.corporateEmail}
              </a>
              {CONTACT.email && (
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="link-underline text-[14px] font-medium text-ink-text-muted transition-colors hover:text-ink-text"
                >
                  {CONTACT.email}
                </a>
              )}
              {CONTACT.phone && (
                <a
                  href={`tel:${CONTACT.phoneHref ?? CONTACT.phone}`}
                  className="link-underline text-[14px] font-medium text-ink-text-muted transition-colors hover:text-ink-text"
                >
                  {CONTACT.phone}
                </a>
              )}
              {address && (
                <span className="text-[13px] leading-relaxed text-ink-text-faint">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              )}
              {socials.length > 0 && (
                <div className="mt-1 flex gap-3">
                  {socials.map(([name, url]) => (
                    <a
                      key={name}
                      href={url}
                      className="font-mono text-[11px] uppercase tracking-wider text-ink-text-faint transition-colors hover:text-accent-bright"
                    >
                      {name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legal strip */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-ink-line py-6">
          <span className="font-mono text-[11px] text-ink-text-faint">
            © {new Date().getFullYear()} {ORG_LEGAL_NAME}
            {REGISTRATION.cin && <> · CIN {REGISTRATION.cin}</>}
            {REGISTRATION.gstin && <> · GSTIN {REGISTRATION.gstin}</>}
          </span>
          <div className="flex gap-5">
            <Link
              href="/privacy"
              className="link-underline font-mono text-[11px] text-ink-text-faint transition-colors hover:text-ink-text"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="link-underline font-mono text-[11px] text-ink-text-faint transition-colors hover:text-ink-text"
            >
              Terms
            </Link>
            <Link
              href="/credits"
              className="link-underline font-mono text-[11px] text-ink-text-faint transition-colors hover:text-ink-text"
            >
              Photo credits
            </Link>
          </div>
        </div>
      </div>

      {/* Oversized wordmark, cropped by the bottom edge. Decorative, so it is
          hidden from assistive tech and clipped rather than scrolled to. */}
      <div aria-hidden="true" className="relative select-none overflow-hidden">
        <p className="-mb-[0.22em] translate-y-[0.06em] text-center font-display text-[22vw] font-bold leading-[0.8] tracking-tighter text-ink-text/[0.06]">
          YaadiGo
        </p>
      </div>
    </footer>
  );
}
