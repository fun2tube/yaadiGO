"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, ChevronIcon, SparkleIcon } from "./icons";
import { useConcierge } from "./concierge/concierge-provider";
import NavMegaMenu from "./nav-mega-menu";
import { CORPORATE_URL } from "@/lib/site";

// Leisure products only (see docs/design/homepage-content-strategy.md):
// one name per product, used everywhere. Corporate is a different audience
// with its own landing page, so it sits apart on the right as "For Corporate".
const NAV_LINKS = [
  { href: "/group-tours", label: "Group Tours", index: "01", mega: true },
  { href: "/customized-tours", label: "Customized Tours", index: "02" },
  { href: "/plan", label: "AI Planner", index: "03" },
  { href: "/blog", label: "Journal", index: "04" },
];

const MOBILE_LINKS = [
  ...NAV_LINKS,
  { href: "/about", label: "About", index: "05" },
  { href: "/contact", label: "Contact", index: "06" },
  { href: "/corporate", label: "For Corporate", index: "07" },
];

/**
 * The links are passed in rather than read from the constants above, so an
 * admin can rename and reorder the menu. The constants remain the fallback —
 * if nothing is saved, the server hands back exactly these.
 */
export default function SiteNavClient({ trips, links, mobileLinks }) {
  const navLinks = links?.length ? links : NAV_LINKS;
  const mobileNavLinks = mobileLinks?.length ? mobileLinks : MOBILE_LINKS;

  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mega, setMega] = useState(false);

  const pathname = usePathname();
  const { openPanel } = useConcierge();
  const listRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // One scroll handler drives both the bar's state and the progress rule.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrolled(y > 12);
        setProgress(max > 0 ? Math.min(y / max, 1) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setMega(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cmd/Ctrl+K opens the concierge. The bar advertises the shortcut, so it
  // has to actually work — a fake affordance is worse than none.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(false);
        openPanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPanel]);

  const megaTimer = useRef(null);

  function openMega() {
    clearTimeout(megaTimer.current);
    setMega(true);
  }

  function closeMega() {
    clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMega(false), 140);
  }

  useEffect(() => () => clearTimeout(megaTimer.current), []);

  return (
    <header className="no-print fixed inset-x-0 top-0 z-50">
      {/* A solid bar, not a translucent pill over the photo (2026-10-11: the
          owner could not read the menu over the hero). White, dark text,
          a hairline and a shadow once the page moves. */}
      <div
        className={`border-b bg-white transition-shadow duration-300 ${
          scrolled ? "border-paper-line shadow-[0_6px_24px_-12px_rgb(26_25_23/0.25)]" : "border-paper-line"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="YaadiGo home">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent">
              <LogoMark />
            </span>
            <span className="font-display text-[19px] font-extrabold tracking-tight text-paper-text">
              YaadiGo
            </span>
          </Link>

          <nav
            ref={listRef}
            onMouseLeave={closeMega}
            aria-label="Main"
            className="hidden items-center gap-1 lg:flex"
          >
            {navLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              // The AI planner is the product's front door — it gets a mark.
              const ai = link.href === "/plan";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => (link.mega ? openMega() : closeMega())}
                  onFocus={() => (link.mega ? openMega() : closeMega())}
                  aria-current={active ? "page" : undefined}
                  aria-expanded={link.mega ? mega : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-[15px] font-semibold transition-colors ${
                    active
                      ? "bg-accent-soft text-accent-deep"
                      : "text-paper-text hover:bg-paper-dim"
                  }`}
                >
                  {ai && <SparkleIcon size={15} className="text-accent" />}
                  {link.label}
                  {link.mega && (
                    <ChevronIcon
                      size={12}
                      dir="down"
                      className={`text-paper-text-muted transition-transform ${mega ? "rotate-180" : ""}`}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={CORPORATE_URL}
              className="hidden whitespace-nowrap px-2 text-[14px] font-semibold text-paper-text-muted transition-colors hover:text-paper-text xl:block"
            >
              For Corporate
            </a>
            <Link
              href="/contact"
              className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-semibold text-paper-text transition-colors hover:bg-paper-dim lg:block"
            >
              Talk to us
            </Link>
            <Link
              href="/plan"
              className="hidden items-center gap-2 whitespace-nowrap rounded-lg bg-accent px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-accent-deep sm:flex"
            >
              <SparkleIcon size={15} /> Plan my trip
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-paper-dim lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              <span
                className={`h-[2px] w-5 rounded-full bg-paper-text transition-transform duration-300 ${
                  open ? "translate-y-[3.5px] rotate-45" : ""
                }`}
              />
              <span
                className={`h-[2px] w-5 rounded-full bg-paper-text transition-transform duration-300 ${
                  open ? "-translate-y-[3.5px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Reading progress, on the bar's bottom edge. */}
        <div
          aria-hidden="true"
          className="h-[2px] origin-left bg-accent transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Destinations mega-panel, under the bar. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
          className={`mt-2 origin-top overflow-hidden rounded-2xl border border-paper-line-strong bg-white shadow-2xl shadow-ink/10 transition-all duration-200 ${
            mega ? "visible opacity-100" : "invisible -translate-y-2 opacity-0"
          }`}
          hidden={!mega}
        >
          <NavMegaMenu
            trips={trips}
            onNavigate={() => setMega(false)}
            onAskYaadi={() => {
              setMega(false);
              openPanel();
            }}
          />
        </div>
      </div>

      {/* Mobile: a full sheet with large, plain links. */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto bg-white lg:hidden">
          <nav aria-label="Main" className="flex flex-col px-5 pt-4 sm:px-8">
            {mobileNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 border-b border-paper-line py-4 text-[19px] font-semibold text-paper-text"
              >
                {link.href === "/plan" && <SparkleIcon size={17} className="text-accent" />}
                {link.label}
                <ChevronIcon size={16} className="ml-auto text-paper-text-faint" />
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2.5 px-5 pb-8 pt-6 sm:px-8">
            <Link
              href="/plan"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-[15px] font-bold text-white"
            >
              <SparkleIcon size={16} /> Plan my trip with AI
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openPanel();
              }}
              className="rounded-xl border border-paper-line-strong px-5 py-3.5 text-[15px] font-semibold text-paper-text"
            >
              Ask Yaadi a question
            </button>
            <a
              href={CORPORATE_URL}
              className="py-2 text-center text-[14px] font-semibold text-paper-text-muted"
            >
              Booking for a company? For Corporate →
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
