"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  HomeIcon,
  CompassIcon,
  MapIcon,
  ChatIcon,
  ReceiptIcon,
  UsersIcon,
  RerouteIcon,
  PulseIcon,
  SparkleIcon,
  ChevronIcon,
  CalendarIcon,
  ImageIcon,
  GridIcon,
  LinkIcon,
  StarIcon,
  HotelIcon,
} from "@/components/icons";
import BrandLogo from "@/components/brand-logo";
import { userCan } from "@/lib/crm/schema";
import NotificationBell from "@/components/cms/notification-bell";

/**
 * Every destination in the panel, with the permission that unlocks it.
 *
 * Gating here rather than in each page means a tab can never appear that would
 * 403 when tapped — which reads as a broken app, not as a permission.
 * `primary` marks the five that fit a phone's bottom bar; the rest live in the
 * sidebar and the More sheet.
 */
const TABS = [
  { href: "/admin", label: "Overview", Icon: HomeIcon, exact: true, permission: null, primary: true },
  { href: "/admin/leads", label: "Leads", Icon: ChatIcon, permission: "leads.read", primary: true },
  { href: "/admin/customers", label: "Customers", Icon: StarIcon, permission: "leads.read" },
  { href: "/admin/bookings", label: "Bookings", Icon: ReceiptIcon, permission: "bookings.read", primary: true },
  { href: "/admin/quotations", label: "Quotes", Icon: SparkleIcon, permission: "quotations.read", primary: true },
  { href: "/admin/operations", label: "Ops", Icon: RerouteIcon, permission: "bookings.read", primary: true },
  // Group tours AND customized trips — one catalogue to the person keeping it
  // up to date. The old "Places" screen redirects here.
  { href: "/admin/trips", label: "Trips", Icon: CompassIcon, permission: "catalogue.read" },
  // Sales price stays from the rate cards, so quotation builders see it too.
  { href: "/admin/hotels", label: "Hotels", Icon: HotelIcon, permission: "catalogue.read", alsoPermission: ["quotations.read"] },
  // Every batch of every group trip: seats, holds, waitlist, traveller list.
  { href: "/admin/departures", label: "Departures", Icon: CalendarIcon, permission: "bookings.read" },
  // Secondary, not a primary tab: building pages is an occasional job, and the
  // five thumb-reachable slots belong to the work done every day.
  { href: "/admin/pages", label: "Pages", Icon: MapIcon, permission: "content.write" },
  // Hotel, trip and activity photos — uploaded once, picked into any quotation.
  { href: "/admin/media", label: "Media", Icon: ImageIcon, permission: "quotations.read", alsoPermission: ["catalogue.read", "content.write"] },
  // Visible to anyone who can read a booking, so sales can answer "has the
  // invoice gone out?" without asking accounts. Only ISSUING is restricted.
  { href: "/admin/invoices", label: "Invoices", Icon: ReceiptIcon, permission: "bookings.read" },
  { href: "/admin/reports", label: "Reports", Icon: PulseIcon, permission: "reports.read" },
  { href: "/admin/traffic", label: "Traffic", Icon: LinkIcon, permission: "reports.read" },
  { href: "/admin/team", label: "Team", Icon: UsersIcon, permission: "team.read" },
];

/**
 * Bottom tab bar on phones, sidebar on desktop — the same links, rendered
 * where each device puts navigation. Written once rather than as two
 * components, so a new section can never appear in one and not the other.
 */
export default function AdminNav({ user, unread = 0 }) {
  const pathname = usePathname();
  const router = useRouter();

  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (tab) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  const visible = TABS.filter(
    (tab) =>
      !tab.permission ||
      userCan(user, tab.permission) ||
      (tab.alsoPermission ?? []).some((p) => userCan(user, p))
  );

  // A phone bottom bar holds five. Everything else goes behind "More" —
  // promised by the comment above since the panel was written and never
  // built, so below 1024 px Trips, Departures, Pages, Invoices, Reports and
  // Team could not be reached at all (found 2026-10-14).
  const primary = visible.filter((tab) => tab.primary);
  const others = visible.filter((tab) => !tab.primary);
  const bottom = others.length > 0 ? primary.slice(0, 4) : primary.slice(0, 5);
  const inMore = [...primary.slice(bottom.length), ...others];
  const moreActive = inMore.some((tab) => isActive(tab));

  // Escape closes the sheet; following a link in it closes it too (onClick).
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);


  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 border-r border-paper-line py-6 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-3" aria-label="YaadiGo admin home">
          <BrandLogo height={40} />
          <span className="font-mono text-[9px] uppercase leading-none tracking-[0.14em] text-paper-text-faint">
            Admin
          </span>
        </Link>

        {visible.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive(tab) ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
              isActive(tab)
                ? "bg-accent/12 text-accent-deep"
                : "text-paper-text-muted hover:bg-paper-line/40 hover:text-paper-text"
            }`}
          >
            <tab.Icon size={17} />
            {tab.label}
          </Link>
        ))}

        <div className="mt-auto flex flex-col gap-1 px-1">
          <div className="px-1.5 pb-1">
            <NotificationBell initialUnread={unread} />
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-paper-text-muted hover:text-paper-text"
          >
            View site <ChevronIcon size={12} />
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold text-paper-text-faint hover:text-danger"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-paper-line bg-paper/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/admin" className="flex items-center gap-2" aria-label="YaadiGo admin home">
          <BrandLogo height={30} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-text-faint">
            Admin
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-paper-text-muted"
          >
            View site
          </Link>
          <NotificationBell />
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-paper-text-faint"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="h-[52px] lg:hidden" aria-hidden="true" />

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-paper-line bg-paper/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-lg">
          {bottom.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive(tab) ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5"
            >
              <span
                className={`flex h-8 w-full max-w-[52px] items-center justify-center rounded-xl transition-colors ${
                  isActive(tab) ? "bg-accent/12 text-accent-deep" : "text-paper-text-faint"
                }`}
              >
                <tab.Icon size={18} />
              </span>
              <span
                className={`text-[10px] font-bold ${
                  isActive(tab) ? "text-paper-text" : "text-paper-text-faint"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          ))}
          {inMore.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-controls="admin-more-sheet"
              className="flex flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5"
            >
              <span
                className={`flex h-8 w-full max-w-[52px] items-center justify-center rounded-xl transition-colors ${
                  moreOpen || moreActive ? "bg-accent/12 text-accent-deep" : "text-paper-text-faint"
                }`}
              >
                <GridIcon size={18} />
              </span>
              <span
                className={`text-[10px] font-bold ${
                  moreOpen || moreActive ? "text-paper-text" : "text-paper-text-faint"
                }`}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* The More sheet: every other section this person can open, two taps
          from anywhere. */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="More sections">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div
            id="admin-more-sheet"
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-paper-line bg-paper px-4 pb-24 pt-4 shadow-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-paper-line-strong" aria-hidden="true" />
            <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
              {inMore.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive(tab) ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5 text-[12.5px] font-bold ${
                    isActive(tab)
                      ? "border-accent/40 bg-accent/10 text-accent-deep"
                      : "border-paper-line bg-card text-paper-text"
                  }`}
                >
                  <tab.Icon size={20} />
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
