import Link from "next/link";
import { listRecords } from "@/lib/cms/records";
import { listEdits } from "@/lib/cms/store";
import { getTrips, getDestinations } from "@/lib/cms/catalogue";
import { media } from "@/lib/media";
import { listBookings } from "@/lib/cms/bookings";
import { currentUser } from "@/lib/cms/auth";
import { buildMyDay } from "@/lib/crm/workspace";
import { userCan } from "@/lib/crm/schema";
import MyDay from "@/components/cms/my-day";
import { ChevronIcon, SparkleIcon, AlertIcon } from "@/components/icons";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/**
 * The overview answers one question: what needs attention today.
 *
 * So it leads with new leads and thin inventory rather than with vanity
 * counts — a dashboard that opens on "14 trips" tells a travel desk nothing
 * they did not already know.
 */
export default async function AdminOverview() {
  const user = await currentUser();

  // Anyone who works leads gets their day first. A generic inventory count is
  // useless to a salesperson at 9am; "who do I ring" is the whole job.
  const worksLeads = userCan(user, "leads.write");
  const day = worksLeads
    ? await buildMyDay({ ownerId: userCan(user, "team.read") ? null : user.id })
    : null;

  const [leads, bookings, trips, destinations, edits] = await Promise.all([
    listRecords("leads"),
    listBookings(),
    getTrips({ includeUnpublished: true }),
    getDestinations({ includeUnpublished: true }),
    listEdits(),
  ]);

  const newLeads = leads.filter((lead) => (lead.status ?? "new") === "new");
  const today = new Date().toDateString();
  const todayLeads = leads.filter(
    (lead) => new Date(lead.receivedAt ?? lead.createdAt).toDateString() === today
  );

  // Batches with three or fewer seats — the ones worth chasing or closing.
  const tight = trips.flatMap((trip) =>
    trip.departures
      .filter((d) => d.seatsLeft > 0 && d.seatsLeft <= 3)
      .map((d) => ({ trip, departure: d }))
  );

  const toConfirm = bookings.filter((b) => b.status === "requested");
  const awaiting = bookings.filter((b) => b.status === "confirmed");
  const awaitingValue = awaiting.reduce((sum, b) => sum + (b.advance ?? 0), 0);

  const soldOutOnly = trips.filter((t) => t.published !== false && t.departureCount === 0);
  const hidden = [...trips, ...destinations].filter((item) => item.published === false);

  if (day) {
    return (
      <>
        <MyDay day={day} name={user.name} />

        <section className="mt-8">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Across the desk
          </h2>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Bookings", value: bookings.length, href: "/admin/bookings" },
              { label: "Quotations", value: 0, href: "/admin/quotations" },
              { label: "Trips", value: trips.length, href: "/admin/trips" },
              { label: "Leads", value: leads.length, href: "/admin/leads" },
            ]
              .filter((stat) => stat.label !== "Quotations")
              .map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="rounded-2xl border border-paper-line bg-card p-3.5 transition-colors hover:border-accent/50"
                >
                  <span className="font-display text-[22px] font-bold text-paper-text">
                    {stat.value}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-paper-text-muted">
                    {stat.label}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Today
        </h1>
        <p className="mt-1 text-[13.5px] text-paper-text-muted">
          {todayLeads.length} enquir{todayLeads.length === 1 ? "y" : "ies"} today ·{" "}
          {newLeads.length} waiting to be called
        </p>
      </header>

      {/* What needs doing */}
      <div className="flex flex-col gap-2.5">
        <Link
          href="/admin/leads"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/8 px-4 py-4"
        >
          <div>
            <p className="font-display text-[24px] font-bold leading-none text-paper-text">
              {newLeads.length}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-paper-text">
              {newLeads.length === 1 ? "lead needs a call" : "leads need a call"}
            </p>
            {newLeads[0] && (
              <p className="mt-0.5 font-mono text-[11px] text-paper-text-muted">
                Oldest: {newLeads[newLeads.length - 1].name}
              </p>
            )}
          </div>
          <ChevronIcon
            size={16}
            className="shrink-0 text-accent-deep transition-transform group-hover:translate-x-1"
          />
        </Link>

        {toConfirm.length > 0 && (
          <Link
            href="/admin/bookings"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-paper-line bg-card px-4 py-4"
          >
            <div>
              <p className="font-display text-[24px] font-bold leading-none text-paper-text">
                {toConfirm.length}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-paper-text">
                seat request{toConfirm.length === 1 ? "" : "s"} to confirm
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-paper-text-muted">
                Seats are not held until you confirm
              </p>
            </div>
            <ChevronIcon
              size={16}
              className="shrink-0 text-accent-deep transition-transform group-hover:translate-x-1"
            />
          </Link>
        )}

        {awaiting.length > 0 && (
          <Link
            href="/admin/bookings"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-4"
          >
            <div>
              <p className="font-display text-[24px] font-bold leading-none text-paper-text">
                ₹{awaitingValue.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-paper-text">
                advance not yet received
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-paper-text-muted">
                {awaiting.length} confirmed booking{awaiting.length === 1 ? "" : "s"} holding seats
              </p>
            </div>
            <ChevronIcon
              size={16}
              className="shrink-0 text-accent-deep transition-transform group-hover:translate-x-1"
            />
          </Link>
        )}

        {tight.length > 0 && (
          <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-4">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-paper-text">
              <span className="text-warn">
                <AlertIcon size={14} />
              </span>
              {tight.length} batch{tight.length === 1 ? "" : "es"} nearly full
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {tight.slice(0, 4).map(({ trip, departure }) => (
                <li key={departure.id} className="flex justify-between gap-3 text-[12.5px]">
                  <Link href="/admin/trips" className="truncate text-paper-text hover:underline">
                    {trip.title}
                  </Link>
                  <span className="shrink-0 font-mono text-[11px] text-warn">
                    {departure.seatsLeft} left
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {soldOutOnly.length > 0 && (
          <div className="rounded-2xl border border-paper-line bg-card px-4 py-4">
            <p className="text-[13px] font-bold text-paper-text">
              {soldOutOnly.length} listed trip{soldOutOnly.length === 1 ? " has" : "s have"} no
              bookable dates
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
              Visitors can open {soldOutOnly.length === 1 ? "it" : "them"} but cannot book. Add a
              batch or hide {soldOutOnly.length === 1 ? "it" : "them"}.
            </p>
            <Link
              href="/admin/trips"
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-accent-deep"
            >
              Open trips <ChevronIcon size={11} />
            </Link>
          </div>
        )}
      </div>

      {/* Inventory */}
      <section className="mt-7">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          Inventory
        </h2>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Trips", value: trips.length, href: "/admin/trips" },
            { label: "Customized", value: destinations.length, href: "/admin/trips?kind=customized" },
            { label: "Bookings", value: bookings.length, href: "/admin/bookings" },
            { label: "Leads", value: leads.length, href: "/admin/leads" },
            { label: "Images", value: media.length, href: "/media" },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border border-paper-line bg-card p-3.5 transition-colors hover:border-accent/50"
            >
              <span className="font-display text-[22px] font-bold text-paper-text">
                {stat.value}
              </span>
              <span className="mt-0.5 block text-[12px] text-paper-text-muted">{stat.label}</span>
            </Link>
          ))}
        </div>
        {hidden.length > 0 && (
          <p className="mt-2 font-mono text-[10.5px] text-paper-text-faint">
            {hidden.length} hidden from the site
          </p>
        )}
      </section>

      {/* Inline editing */}
      <section className="mt-7 rounded-2xl border border-paper-line bg-card p-4">
        <h2 className="flex items-center gap-2 text-[14px] font-bold text-paper-text">
          <SparkleIcon size={15} className="text-accent-deep" /> Editing pages
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-paper-text-muted">
          Open any page, switch on <strong className="font-semibold">Edit page</strong>, and click
          what you want to change — or select it and ask the assistant.
          {edits.count > 0 && ` ${edits.count} element${edits.count === 1 ? "" : "s"} edited so far.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/", label: "Homepage" },
            { href: "/group-tours", label: "Group tours" },
            { href: "/customized-tours", label: "Destinations" },
            { href: "/corporate-travel", label: "Corporate" },
          ].map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-lg border border-paper-line-strong px-3 py-1.5 text-[12.5px] font-semibold text-paper-text-muted hover:border-accent hover:text-accent-deep"
            >
              {page.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
