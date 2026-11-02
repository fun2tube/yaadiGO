"use client";

import { usePathname } from "next/navigation";
import MobileBar from "@/components/mobile-bar";
import WhatsAppFab from "@/components/whatsapp-fab";
import ConciergeLauncher from "@/components/concierge/concierge-launcher";
import ConciergePanel from "@/components/concierge/concierge-panel";

/**
 * The customer-facing furniture: bottom tabs, WhatsApp button, Yaadi.
 *
 * Why this exists: all of it used to be mounted unconditionally in the root
 * layout, which meant **the CRM got it too**. A salesperson checking leads on
 * a phone saw the public bottom bar — Home, Tours, AI Plan, Corporate — on top
 * of the admin's own tab bar, two navigation bars at once, plus a "quick
 * enquiry" WhatsApp button aimed at customers and a concierge offering to plan
 * them a holiday.
 *
 * None of it is wrong on the website. All of it is nonsense on the desk.
 *
 * A nested layout cannot remove what a parent layout renders, and the root
 * layout is a server component so it cannot read the pathname. Hence a client
 * component that excludes itself.
 *
 * The architecturally correct fix is a `(site)` route group owning this
 * chrome, leaving the root layout with nothing but `<html>`. That is a move of
 * every public page directory, so it is logged as its own task rather than
 * smuggled in next to a bug fix.
 */
export default function PublicChrome({ whatsappHref }) {
  const pathname = usePathname();

  // Everything under /admin is the CRM, including the sign-in and invite pages
  // — a customer bottom bar on a staff login screen is just as odd.
  if (pathname?.startsWith("/admin")) return null;
  // PDF render targets (/pdf/*) are documents printed by the server's
  // headless browser; a WhatsApp button has no business in the file.
  if (pathname?.startsWith("/pdf/")) return null;

  return (
    <>
      <MobileBar whatsappHref={whatsappHref} />
      <WhatsAppFab />
      <ConciergeLauncher />
      <ConciergePanel />
    </>
  );
}
