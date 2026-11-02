import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan, bookingHoldsSeats } from "@/lib/crm/schema";
import { getTrip } from "@/lib/cms/catalogue";
import { listBookings } from "@/lib/cms/bookings";
import { listHolds, listWaitlist } from "@/lib/cms/seats";
import { formatDepartureRange } from "@/lib/tours";
import DepartureDesk from "@/components/cms/departure-desk";
import { ChevronIcon } from "@/components/icons";

export const metadata = { title: "Departure" };
export const dynamic = "force-dynamic";

export default async function DeparturePage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const { slug, id } = await params;
  const trip = await getTrip(slug, { includeUnpublished: true });
  const departure = trip?.departures.find((d) => d.id === id);
  if (!departure) notFound();

  const [bookings, holds, waitlist] = await Promise.all([
    listBookings(),
    listHolds({ tripSlug: slug, departureId: id }),
    listWaitlist({ tripSlug: slug, departureId: id }),
  ]);
  const onBatch = bookings
    .filter((b) => b.tripSlug === slug && b.departureId === id)
    .map((b) => ({
      id: b.id,
      reference: b.reference,
      name: b.name,
      phone: b.phone,
      travellers: b.travellers,
      status: b.status,
      holdsSeats: bookingHoldsSeats(b.status),
      total: b.total,
      collected: b.collected ?? 0,
    }));

  return (
    <>
      <Link href="/admin/departures" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-paper-text-muted">
        <ChevronIcon size={13} className="rotate-180" /> All departures
      </Link>
      <DepartureDesk
        trip={{ slug: trip.slug, title: trip.title, listed: trip.published !== false }}
        departure={{ ...departure, label: formatDepartureRange(departure) }}
        bookings={onBatch}
        holds={holds}
        waitlist={waitlist}
        canSell={userCan(user, "bookings.write")}
        canManage={userCan(user, "catalogue.write")}
      />
    </>
  );
}
