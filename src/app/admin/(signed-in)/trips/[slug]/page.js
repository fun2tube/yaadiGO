import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { getDestination, getDestinations, getTrip, getTrips } from "@/lib/cms/catalogue";
import { getTripForEdit } from "@/lib/cms/trips";
import { media } from "@/lib/media";
import { tripPath } from "@/lib/trip-model";
import TripStudio from "@/components/cms/trip-studio";
import { ChevronIcon } from "@/components/icons";

export const metadata = { title: "Edit trip" };
export const dynamic = "force-dynamic";

export default async function TripEditPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "catalogue.read")) redirect("/admin");

  const { slug } = await params;
  const current =
    (await getTrip(slug, { includeUnpublished: true })) ??
    (await getDestination(slug, { includeUnpublished: true }));
  const trip = await getTripForEdit(slug, current);
  if (!trip) notFound();

  // Where an archived trip may forward its visitors: any live trip of the
  // same kind, or the listing.
  const live =
    trip.kind === "group"
      ? await getTrips()
      : await getDestinations();
  const redirectOptions = [
    { value: tripPath(trip.kind, "").replace(/\/$/, ""), label: `The ${trip.kind === "group" ? "group tours" : "customized trips"} listing` },
    ...live
      .filter((t) => t.slug !== slug)
      .map((t) => ({ value: tripPath(trip.kind, t.slug), label: t.title })),
  ];

  return (
    <>
      <Link
        href="/admin/trips"
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-paper-text-muted"
      >
        <ChevronIcon size={13} className="rotate-180" /> All trips
      </Link>
      <TripStudio
        trip={trip}
        // Departures exist only once the trip is in the catalogue (published
        // to the site or to sales at least once).
        departureTrip={trip.kind === "group" && current?.departures ? current : null}
        photos={media.map(({ id, src, title }) => ({ id, src, title }))}
        redirectOptions={redirectOptions}
        canWrite={userCan(user, "catalogue.write")}
      />
    </>
  );
}
