import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { getDestinations, getTrips } from "@/lib/cms/catalogue";
import { listTripsForAdmin } from "@/lib/cms/trips";
import { getImage } from "@/lib/media";
import TripList from "@/components/cms/trip-list";

export const metadata = { title: "Trips" };
export const dynamic = "force-dynamic";

/**
 * Every trip the business sells — group tours and customized trips together,
 * because they are one catalogue to the person maintaining it.
 */
export default async function TripsPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "catalogue.read")) redirect("/admin");

  const [trips, destinations, params] = await Promise.all([
    getTrips({ includeUnpublished: true }),
    getDestinations({ includeUnpublished: true }),
    searchParams,
  ]);
  const rows = (await listTripsForAdmin({ trips, destinations })).map((row) => ({
    ...row,
    thumb: getImage(row.coverImageId)?.src ?? getImage(row.slug)?.src ?? null,
  }));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Trips</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Group tours and customized trips. Edits are saved as a draft; nothing changes on the
          website until you press Publish.
        </p>
      </header>
      <TripList
        rows={rows}
        canWrite={userCan(user, "catalogue.write")}
        initialKind={params?.kind === "customized" || params?.kind === "group" ? params.kind : "all"}
      />
    </>
  );
}
