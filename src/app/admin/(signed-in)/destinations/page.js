import { redirect } from "next/navigation";

/**
 * Customized trips are now edited alongside group tours, in the full trip
 * editor (docs/design/trip-management.md). Kept as a redirect so bookmarks
 * and old links still land somewhere useful.
 */
export default function DestinationsPage() {
  redirect("/admin/trips?kind=customized");
}
