"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark, ChevronIcon } from "@/components/icons";
import { SITE_URL } from "@/lib/site";

const SECTIONS = [
  { href: "#services", label: "Services" },
  { href: "#how", label: "How it works" },
  { href: "#billing", label: "Billing" },
  { href: "#mice", label: "Offsites" },
];

/**
 * Nav for the corporate subdomain. Deliberately different from the main site
 * nav: a procurement or HR lead landing here wants the desk, not group tours,
 * so the links are in-page sections and the one outbound link goes back to
 * the consumer site.
 */
export default function CorporateNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-ink-line bg-ink/85 backdrop-blur-xl"
          : "border-b border-transparent bg-ink/40 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 sm:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-accent">
            <LogoMark />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[17px] font-black tracking-tight text-ink-text">
              YaadiGo
            </span>
            <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-accent">
              For Corporate
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-[13.5px] font-semibold text-ink-text-muted transition-colors hover:text-ink-text"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a
            href={SITE_URL}
            className="hidden items-center gap-1 text-[13px] font-bold text-ink-text-faint transition-colors hover:text-ink-text lg:flex"
          >
            Leisure travel <ChevronIcon size={13} />
          </a>
          <a
            href="#corporate-enquiry"
            className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-bold text-white transition-transform hover:scale-[1.04]"
          >
            Talk to the desk
          </a>
        </div>
      </div>
    </header>
  );
}
