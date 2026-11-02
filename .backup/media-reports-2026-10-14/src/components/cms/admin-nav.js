"use client";

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
  LogoMark,
  ChevronIcon,
  CalendarIcon,
} from "@/components/icons";
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
  { href: "/admin/bookings", label: "Bookings", Icon: ReceiptIcon, permission: "bookings.read", primary: true },
  { href: "/admin/quotations", label: "Quotes", Icon: SparkleIcon, permission: "quotations.read", primary: true },
  { href: "/admin/operations", label: "Ops", Icon: RerouteIcon, permission: "bookings.read", primary: true },
  // Group tours AND customized trips — one catalogue to the person keeping it
  // up to date. The old "Places" screen redirects here.
  { href: "/admin/trips", label: "Trips", Icon: CompassIcon, permission: "catalogue.read" },
  // Every batch of every group trip: seats, holds, waitlist, traveller list.
  { href: "/admin/departures", label: "Departures", Icon: CalendarIcon, permission: "bookings.read" },
  // Secondary, not a primary tab: building pages is an occasional job, and the
  // five thumb-reachable slots belong to the work done every day.
  { href: "/admin/pages", label: "Pages", Icon: MapIcon, permission: "content.write" },
  // Visible to anyone who can read a booking, so sales can answer "has the
  // invoice gone out?" without asking accounts. Only ISSUING is restricted.
  { href: "/admin/invoices", label: "Invoices", Icon: ReceiptIcon, permission: "bookings.read" },
  { href: "/admin/reports", label: "Reports", Icon: PulseIcon, permission: "reports.read" },
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

  const visible = TABS.filter((tab) => !tab.permission || userCan(user, tab.permission));
  // A phone bottom bar holds five comfortably; the sidebar shows everything.
  const bottom = visible.filter((tab) => tab.primary).slice(0, 5);

  const isActive = (tab) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col gap-1 border-r border-paper-line py-6 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <LogoMark />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-bold text-paper-text">YaadiGo</span>
            <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-text-faint">
              Admin
            </span>
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
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
            <LogoMark />
          </span>
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
        </div>
      </nav>
    </>
  );
}
