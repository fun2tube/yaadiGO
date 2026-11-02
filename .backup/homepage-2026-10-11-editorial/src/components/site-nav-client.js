"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, ChevronIcon, SparkleIcon } from "./icons";
import { useConcierge } from "./concierge/concierge-provider";
import DeskStatus from "./desk-status";
import NavMegaMenu from "./nav-mega-menu";
import { CORPORATE_URL } from "@/lib/site";

// Numbered like a contents list — a small technical signal that costs nothing
// and stops the bar reading like every other marketing nav.
//
// Leisure products only (see docs/design/homepage-content-strategy.md):
// one name per product, used everywhere. Corporate is a different audience
// with its own site, so it sits apart on the right as "For business".
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
];

// Platform is a client-only fact that never changes, so it is read through
// useSyncExternalStore: the server renders "Ctrl", the client corrects to the
// Mac glyph during hydration, and no effect has to set state to do it.
const subscribePlatform = () => () => {};
const getIsMac = () => /Mac|iPhone|iPad/.test(navigator.platform ?? "");
const getIsMacServer = () => false;

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
  const [indicator, setIndicator] = useState(null);
  const [mega, setMega] = useState(false);
  const isMac = useSyncExternalStore(subscribePlatform, getIsMac, getIsMacServer);

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

  /** Slides the hover pill onto whichever item the pointer or focus is on. */
  function moveIndicator(event) {
    const item = event.currentTarget;
    setIndicator({ left: item.offsetLeft, width: item.offsetWidth });
  }

  return (
    <header className="no-print pointer-events-none fixed inset-x-0 top-0 z-50">
      {/* Reading progress. A 2px rule rather than a chunky bar — information,
          not decoration. */}
      <div
        aria-hidden="true"
        className="h-[2px] origin-left bg-accent transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />

      <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        <div
          className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-300 sm:px-4 ${
            scrolled
              ? "border-paper-line-strong bg-paper/85 shadow-lg shadow-ink/5 backdrop-blur-xl"
              : "border-transparent bg-paper/40 backdrop-blur-sm"
          }`}
        >
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-accent">
              <LogoMark />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-[17px] font-bold tracking-tight text-paper-text">
                YaadiGo
              </span>
              <span className="mt-[3px] hidden font-mono text-[9px] uppercase tracking-[0.16em] text-paper-text-faint sm:block">
                Travel Systems
              </span>
            </span>
          </Link>

          <nav
            ref={listRef}
            onMouseLeave={() => {
              setIndicator(null);
              closeMega();
            }}
            className="relative hidden items-center lg:flex"
          >
            {/* The pill that follows the pointer. One element, transformed —
                not a border toggled on each item. */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 rounded-xl bg-paper-dim transition-all duration-300 ease-out"
              style={{
                left: indicator?.left ?? 0,
                width: indicator?.width ?? 0,
                opacity: indicator ? 1 : 0,
              }}
            />
            {navLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={(event) => {
                    moveIndicator(event);
                    if (link.mega) openMega();
                    else closeMega();
                  }}
                  onFocus={(event) => {
                    moveIndicator(event);
                    if (link.mega) openMega();
                    else closeMega();
                  }}
                  aria-current={active ? "page" : undefined}
                  aria-expanded={link.mega ? mega : undefined}
                  className="relative z-10 flex items-baseline gap-1.5 rounded-xl px-3 py-2"
                >
                  <span className="hidden font-mono text-[9px] text-paper-text-faint xl:inline">{link.index}</span>
                  <span
                    className={`whitespace-nowrap text-[13.5px] font-semibold transition-colors ${
                      active ? "text-accent-deep" : "text-paper-text-muted"
                    }`}
                  >
                    {link.label}
                  </span>
                  {link.mega && (
                    <ChevronIcon
                      size={11}
                      className={`self-center text-paper-text-faint transition-transform ${
                        mega ? "rotate-90" : ""
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden xl:block">
              <DeskStatus tone="light" showClock={false} />
            </div>

            {/* Command trigger. Reads as a product surface, and it opens the
                same concierge as the floating launcher. */}
            <button
              type="button"
              onClick={openPanel}
              className="hidden items-center gap-2 rounded-xl border border-paper-line-strong px-3 py-2 transition-colors hover:border-accent/60 sm:flex lg:hidden xl:flex"
            >
              <SparkleIcon size={14} className="text-accent-deep" />
              <span className="text-[13px] font-semibold text-paper-text-muted">Yaadi</span>
              <kbd className="rounded border border-paper-line-strong bg-paper-dim px-1.5 py-0.5 font-mono text-[9.5px] text-paper-text-faint">
                {isMac ? "⌘" : "Ctrl"}K
              </kbd>
            </button>

            <a
              href={CORPORATE_URL}
              className="hidden whitespace-nowrap px-1 text-[12.5px] font-semibold text-paper-text-faint transition-colors hover:text-paper-text xl:block"
            >
              For business →
            </a>

            <Link
              href="/contact"
              className="hidden whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-ink-text transition-transform hover:scale-[1.04] lg:block"
            >
              Talk to us
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              <span
                className={`h-[1.5px] w-5 rounded-full bg-paper-text transition-transform duration-300 ${
                  open ? "translate-y-[3.25px] rotate-45" : ""
                }`}
              />
              <span
                className={`h-[1.5px] w-5 rounded-full bg-paper-text transition-transform duration-300 ${
                  open ? "-translate-y-[3.25px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Destinations mega-panel. Sits under the island, inherits its width. */}
        <div
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
          className={`pointer-events-auto mt-2 origin-top overflow-hidden rounded-2xl border border-paper-line-strong bg-paper/95 shadow-2xl shadow-ink/10 backdrop-blur-xl transition-all duration-200 ${
            mega
              ? "visible scale-100 opacity-100"
              : "invisible -translate-y-2 scale-[0.99] opacity-0"
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

      {/* Mobile: a full sheet with large type, not a cramped dropdown. */}
      {open && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex flex-col bg-paper lg:hidden">
          <div className="h-[72px] shrink-0" />
          <nav className="flex flex-1 flex-col justify-center px-6 sm:px-10">
            {mobileNavLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{ "--reveal-delay": `${i * 45}ms` }}
                data-reveal
                className="group flex items-baseline gap-3 border-b border-paper-line py-4"
              >
                <span className="font-mono text-[10px] text-paper-text-faint">{link.index}</span>
                <span className="font-display text-[26px] font-bold tracking-tight text-paper-text">
                  {link.label}
                </span>
                <ChevronIcon
                  size={16}
                  className="ml-auto self-center text-paper-text-faint transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
          </nav>
          <div className="shrink-0 px-6 pb-8 sm:px-10">
            <DeskStatus tone="light" />
            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openPanel();
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-[15px] font-bold text-white"
              >
                <SparkleIcon size={16} /> Ask Yaadi
              </button>
              <a
                href={CORPORATE_URL}
                className="rounded-xl border border-paper-line-strong px-5 py-3.5 text-center text-[15px] font-bold text-paper-text"
              >
                Corporate Travel Desk →
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
