import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { describeMediaStorage } from "@/lib/media-store";
import MediaManager from "@/components/cms/media-manager";

export const metadata = { title: "Media" };
export const dynamic = "force-dynamic";

/**
 * The photo library — hotels, destinations, activities, transport, maps.
 * Uploaded once here (or from any photo slot in a quotation) and picked into
 * quotations from then on. See docs/design/2026-10-14-media-quotes-reports.md.
 */
export default async function MediaPage() {
  const user = await currentUser();
  const canRead = ["quotations.read", "catalogue.read", "content.write"].some((p) => userCan(user, p));
  if (!canRead) redirect("/admin");

  const canEdit = ["quotations.write", "catalogue.write", "content.write"].some((p) => userCan(user, p));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Media</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Hotel rooms, destinations, activities and transport — upload a photo once and pick it into
          any quotation. Website photos are shown too, read-only.
        </p>
      </header>
      <MediaManager canEdit={canEdit} storage={describeMediaStorage()} />
    </>
  );
}
