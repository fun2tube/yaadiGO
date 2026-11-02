import { redirect } from "next/navigation";
import BookingBoard from "@/components/cms/booking-board";
import { currentUser } from "@/lib/cms/auth";
import { listBookingsFor } from "@/lib/cms/bookings";
import { userCan } from "@/lib/crm/schema";

export const metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  // This page had no permission check of its own and listed every booking to
  // anyone signed in. Now: bookings.read, and a salesperson sees their own.
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const bookings = await listBookingsFor(user);

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Bookings
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Seat requests and approved quotations, soonest departure first. Confirming a seat request
          takes those seats off the batch on the website; cancelling puts them back.
        </p>
      </header>
      <BookingBoard bookings={bookings} />
    </>
  );
}
