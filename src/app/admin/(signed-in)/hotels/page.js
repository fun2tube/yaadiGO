import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { listHotels } from "@/lib/cms/hotels";
import { userCan, money } from "@/lib/crm/schema";

export const metadata = { title: "Hotels" };
export const dynamic = "force-dynamic";

const day = (iso) =>
  iso ? new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

/**
 * The hotel directory: every property we book, by destination, with the
 * cheapest room currently on its rate card and how far ahead it is priced.
 * Sales price stays from these rates in the quotation builder.
 */
export default async function HotelsPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "catalogue.read") && !userCan(user, "quotations.read")) redirect("/admin");

  const params = (await searchParams) ?? {};
  const search = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const showInactive = params.all === "1";
  const hotels = await listHotels({ search, includeInactive: showInactive });
  const canWrite = userCan(user, "catalogue.write");

  const byDestination = new Map();
  for (const h of hotels) byDestination.set(h.destination, [...(byDestination.get(h.destination) ?? []), h]);
  const unpriced = hotels.filter((h) => h.active !== false && !h.currentRates).length;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Hotels</h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-paper-text-muted">
            Every property we book and what we agreed to pay. Quotations price stays from these rates, night by night.
            {unpriced ? ` ${unpriced} active hotel${unpriced === 1 ? " has" : "s have"} no current rates.` : ""}
          </p>
        </div>
        {canWrite ? (
          <Link href="/admin/hotels/new" className="rounded-xl bg-ink px-3.5 py-2 text-[12.5px] font-bold text-ink-text">
            + Add a hotel
          </Link>
        ) : null}
      </header>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Hotel, destination or town"
          aria-label="Search hotels"
          className="min-w-0 flex-1 rounded-xl border border-paper-line-strong bg-card px-3 py-2 text-[13px] text-paper-text"
        />
        <label className="flex items-center gap-1.5 text-[12px] text-paper-text-muted">
          <input type="checkbox" name="all" value="1" defaultChecked={showInactive} /> Show inactive
        </label>
        <button type="submit" className="rounded-xl border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-bold text-paper-text">
          Search
        </button>
      </form>

      {hotels.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-paper-line bg-card px-4 py-3 text-[13px] text-paper-text-muted">
          {search ? `No hotel matches "${search}".` : "No hotels yet. Add the properties you book, with their rates, and quotations can price stays from them."}
        </p>
      ) : (
        [...byDestination.entries()].map(([destination, list]) => (
          <section key={destination} className="mt-6">
            <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
              {destination} · {list.length}
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {list.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/admin/hotels/${h.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-paper-line bg-card px-4 py-3 hover:border-accent"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-[14px] text-paper-text">{h.name}</strong>
                        {h.stars ? <span className="font-mono text-[11px] text-paper-text-faint">{"★".repeat(h.stars)}</span> : null}
                        {h.active === false ? (
                          <span className="rounded-md bg-paper-line-strong px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-paper-text-muted">
                            Inactive
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-paper-text-faint">
                        {[h.city, h.category, h.contactPerson, h.phone].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-paper-text-muted sm:text-right">
                      {h.currentRates ? (
                        <>
                          from {money(h.fromSell)} / room / night
                          <span className="block text-paper-text-faint">priced to {day(h.ratesEndOn)}</span>
                        </>
                      ) : (
                        <span className="text-warn">no current rates</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
