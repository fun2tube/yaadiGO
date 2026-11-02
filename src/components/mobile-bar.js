"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  CompassIcon,
  SparkleIcon,
  MapIcon,
  WhatsAppIcon,
  ChatIcon,
} from "./icons";

/**
 * The app-style bottom bar. On phones this is the primary navigation and the
 * primary CTA surface — every route someone actually converts through is one
 * thumb-reach away, the way a native app would do it.
 *
 * Notes on the details that matter on real devices:
 * - `pb-[env(safe-area-inset-bottom)]` keeps it clear of the iPhone home
 *   indicator; without it the labels sit under the gesture bar.
 * - `h-[100dvh]`-style dynamic units elsewhere depend on this bar not
 *   overlapping content, so layout.js reserves space with a spacer.
 * - It hides while scrolling down and returns on scroll up, so it never
 *   covers what you are reading — but it always returns instantly.
 */

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon, exact: true },
  { href: "/group-tours", label: "Group", Icon: CompassIcon },
  { href: "/customized-tours", label: "Custom", Icon: MapIcon },
  { href: "/plan", label: "AI Plan", Icon: SparkleIcon, highlight: true },
];

export default function MobileBar({ whatsappHref }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        // Ignore rubber-banding at the very top, and small jitters.
        if (y < 80 || Math.abs(y - last) < 8) {
          if (y < 80) setHidden(false);
          last = y;
          return;
        }
        setHidden(y > last);
        last = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const isWhatsApp = whatsappHref.startsWith("http");

  return (
    <nav
      aria-label="Primary"
      className={`no-print fixed inset-x-0 bottom-0 z-50 border-t border-paper-line bg-paper/92 backdrop-blur-xl transition-transform duration-300 md:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {TABS.map(({ href, label, Icon, exact, highlight }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5"
            >
              <span
                className={`flex h-8 w-full max-w-[52px] items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? highlight
                      ? "bg-accent text-white"
                      : "bg-accent/12 text-accent-deep"
                    : highlight
                      ? "text-accent-deep"
                      : "text-paper-text-faint"
                }`}
              >
                <Icon size={19} />
              </span>
              <span
                className={`text-[10px] font-bold tracking-tight ${
                  active ? "text-paper-text" : "text-paper-text-faint"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* The quick-enquiry tab. Falls back to /contact when no WhatsApp
            number is configured, so the bar is never one tab short. */}
        <a
          href={whatsappHref}
          {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="relative flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5"
        >
          <span className="flex h-8 w-full max-w-[52px] items-center justify-center rounded-xl bg-[#25D366] text-white transition-transform active:scale-95">
            {isWhatsApp ? <WhatsAppIcon size={18} /> : <ChatIcon size={18} />}
          </span>
          <span className="text-[10px] font-bold tracking-tight text-paper-text">
            {isWhatsApp ? "WhatsApp" : "Enquire"}
          </span>
        </a>
      </div>
    </nav>
  );
}
