import Link from "next/link";
import { getTrips } from "@/lib/cms/catalogue";
import { ChevronIcon } from "./icons";
import TourCard from "./tour-card";

export default async function GroupToursPreview() {
  const groupTours = await getTrips();

  return (
    <section id="leisure" className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
      <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow text-accent-deep">
            Group Tours
          </span>
          <h2 className="mt-2 font-display text-[28px] font-black tracking-tight text-paper-text sm:text-[34px]">
            Fixed-departure trips, ready to join
          </h2>
        </div>
        <Link
          href="/group-tours"
          className="flex items-center gap-1 text-[14px] font-semibold text-paper-text"
        >
          View all group tours <ChevronIcon size={15} />
        </Link>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groupTours.slice(0, 6).map((tour, i) => (
          <TourCard key={tour.slug} tour={tour} index={i} />
        ))}
      </div>
    </section>
  );
}
