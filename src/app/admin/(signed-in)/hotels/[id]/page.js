import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { getHotel, HOTEL_CATEGORIES, MEAL_PLANS } from "@/lib/cms/hotels";
import { userCan } from "@/lib/crm/schema";
import HotelEditor from "@/components/cms/hotel-editor";

export const metadata = { title: "Hotel" };
export const dynamic = "force-dynamic";

/** One hotel and its rate card. `/admin/hotels/new` starts an empty one. */
export default async function HotelPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "catalogue.read") && !userCan(user, "quotations.read")) redirect("/admin");

  const { id } = await params;
  const canWrite = userCan(user, "catalogue.write");
  let found = { hotel: null, rates: [] };
  if (id === "new") {
    if (!canWrite) redirect("/admin/hotels");
  } else {
    found = await getHotel(id);
    if (!found) notFound();
  }

  return (
    <>
      <header className="mb-4">
        <Link href="/admin/hotels" className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text">
          ← Hotels
        </Link>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-tight text-paper-text">
          {found.hotel?.name ?? "Add a hotel"}
        </h1>
        {found.hotel ? (
          <p className="mt-0.5 font-mono text-[11.5px] text-paper-text-faint">
            {[found.hotel.city, found.hotel.destination, found.hotel.category].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </header>
      <HotelEditor
        hotel={found.hotel}
        rates={found.rates}
        canWrite={canWrite}
        categories={HOTEL_CATEGORIES}
        mealPlans={MEAL_PLANS}
      />
    </>
  );
}
