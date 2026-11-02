import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { getTrips } from "@/lib/cms/catalogue";
import { listHolds, listWaitlist } from "@/lib/cms/seats";
import DepartureBoard from "@/components/cms/departure-board";

export const metadata = { title: "Departures" };
export const dynamic = "force-dynamic";

/** One row per batch, soonest first. Outside the component: it reads the clock. */
function boardRows(trips, holds, waitlist, now = Date.now()) {
  const rows = trips.flatMap((trip) =>
    trip.departures.map((d) => {
      const mine = (x) => x.tripSlug === trip.slug && x.departureId === d.id;
      return {
        tripSlug: trip.slug,
        tripTitle: trip.title,
        tripListed: trip.published !== false,
        id: d.id,
        start: d.start,
        end: d.end,
        price: d.price,
        capacity: d.capacity,
        booked: d.booked,
        held: d.held,
        seatsLeft: d.seatsLeft,
        status: d.status,
        cutoffDate: d.cutoffDate,
        minToRun: d.minToRun,
        guaranteed: d.guaranteed,
        atRisk: d.atRisk,
        waiting: waitlist.filter((w) => mine(w) && w.status === "waiting").length,
        holdsExpiringSoon: holds.filter(
          (h) => mine(h) && h.active && new Date(h.expiresAt).getTime() - now < 12 * 3_600_000
        ).length,
      };
    })
  );
  return rows.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Every batch of every group trip on one screen, soonest first — the view the
 * desk works from: what leaves next, what is full, what is short of its
 * minimum, who is holding seats, who is waiting.
 */
export default async function DeparturesPage() {
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const [trips, holds, waitlist] = await Promise.all([
    getTrips({ includeUnpublished: true }),
    listHolds(),
    listWaitlist(),
  ]);
  const rows = boardRows(trips, holds, waitlist);

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Departures</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Every group-tour batch, soonest first. Seats left are worked out from confirmed bookings and
          active holds — open a batch to hold seats, work its waitlist or print the traveller list.
        </p>
      </header>
      <DepartureBoard rows={rows} />
    </>
  );
}
