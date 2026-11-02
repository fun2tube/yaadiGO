import BookingBoard from "@/components/cms/booking-board";
import { listBookings } from "@/lib/cms/bookings";

export const metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const bookings = await listBookings();

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Bookings
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Seat requests, soonest departure first. Confirming a booking takes those seats off the
          batch on the website; cancelling puts them back.
        </p>
      </header>
      <BookingBoard bookings={bookings} />
    </>
  );
}
