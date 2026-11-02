"use client";

import { usePathname } from "next/navigation";
import EditModeProvider, { EditModeStyles } from "./edit-mode";
import AdminBar from "./admin-bar";
import Inspector from "./inspector";

/**
 * Everything the admin adds to a page, in one client boundary.
 *
 * Rendered only when the server has already confirmed an admin session, so
 * none of this code — or the fact that it exists — reaches a visitor.
 *
 * Not on /admin itself: the page editor edits the public site, and inside the
 * panel its floating "Edit page · Dashboard · Sign out" bar sat on top of the
 * CRM's own content (it covered the AI's assumptions in the quote builder —
 * review 2026-10-14-full-function-test, F15). The panel has its own nav.
 */
export default function AdminShell({ storage }) {
  const pathname = usePathname() ?? "";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <EditModeProvider storage={storage}>
      <EditModeStyles />
      <AdminBar />
      <Inspector />
    </EditModeProvider>
  );
}
