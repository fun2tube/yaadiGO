"use client";

import EditModeProvider, { EditModeStyles } from "./edit-mode";
import AdminBar from "./admin-bar";
import Inspector from "./inspector";

/**
 * Everything the admin adds to a page, in one client boundary.
 *
 * Rendered only when the server has already confirmed an admin session, so
 * none of this code — or the fact that it exists — reaches a visitor.
 */
export default function AdminShell({ storage }) {
  return (
    <EditModeProvider storage={storage}>
      <EditModeStyles />
      <AdminBar />
      <Inspector />
    </EditModeProvider>
  );
}
