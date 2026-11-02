import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan, bookingHoldsSeats } from "@/lib/crm/schema";
import { getTrip } from "@/lib/cms/catalogue";
import { listBookings } from "@/lib/cms/bookings";
import { formatDepartureRange } from "@/lib/tours";
import PrintButton from "@/components/cms/print-button";

export const metadata = { title: "Traveller list" };
export const dynamic = "force-dynamic";

const money = (n) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;

/**
 * The traveller list for one departure — what the trip leader carries.
 *
 * Confirmed and paying bookings only: a request nobody has confirmed is not
 * someone the leader should be waiting for at the airport. Printed with the
 * browser (Save as PDF), like quotations.
 */
export default async function ManifestPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const { slug, id } = await params;
  const trip = await getTrip(slug, { includeUnpublished: true });
  const departure = trip?.departures.find((d) => d.id === id);
  if (!departure) notFound();

  const rows = (await listBookings()).filter(
    (b) => b.tripSlug === slug && b.departureId === id && bookingHoldsSeats(b.status)
  );
  const travellers = rows.reduce((n, b) => n + (Number(b.travellers) || 0), 0);
  const due = rows.reduce((n, b) => n + Math.max(0, (b.total ?? 0) - (b.collected ?? 0)), 0);

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-5 print:border-0 print:p-0">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href={`/admin/departures/${slug}/${id}`} className="text-[13px] font-semibold text-paper-text-muted">
          ← Back to the departure
        </Link>
        <PrintButton className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-ink-text" />
      </div>

      <header className="border-b border-paper-line pb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper-text-faint">YaadiGo · traveller list</p>
        <h1 className="mt-1 font-display text-[22px] font-bold text-paper-text">{trip.title}</h1>
        <p className="text-[13.5px] font-semibold text-paper-text-muted">
          {formatDepartureRange(departure)} · {travellers} traveller{travellers === 1 ? "" : "s"} on{" "}
          {rows.length} booking{rows.length === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-[12px] text-paper-text-faint">
          Trip leader: ______________________ · Vehicle: ______________________ · Printed{" "}
          {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-paper-text-muted">
          Nobody is confirmed on this departure yet.
        </p>
      ) : (
        <table className="mt-3 w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-paper-line-strong font-mono text-[9.5px] uppercase tracking-[0.08em] text-paper-text-faint">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Lead traveller</th>
              <th className="py-2 pr-2">Phone</th>
              <th className="py-2 pr-2 text-center">Pax</th>
              <th className="py-2 pr-2">Room</th>
              <th className="py-2 pr-2">Joins at</th>
              <th className="py-2 pr-2 text-right">Balance due</th>
              <th className="py-2">Ref</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={b.id} className="border-b border-paper-line align-top">
                <td className="py-2 pr-2 text-paper-text-faint">{i + 1}</td>
                <td className="py-2 pr-2 font-semibold text-paper-text">{b.name ?? "—"}</td>
                <td className="py-2 pr-2 text-paper-text-muted">{b.phone ?? "—"}</td>
                <td className="py-2 pr-2 text-center font-semibold">{b.travellers}</td>
                <td className="py-2 pr-2 text-paper-text-muted">{b.sharing ?? "—"}</td>
                <td className="py-2 pr-2 text-paper-text-muted">{b.pickup ?? "—"}</td>
                <td className="py-2 pr-2 text-right font-semibold">{money(Math.max(0, (b.total ?? 0) - (b.collected ?? 0)))}</td>
                <td className="py-2 font-mono text-[11px] text-paper-text-faint">{b.reference ?? ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={3} className="py-2 pr-2">Total</td>
              <td className="py-2 pr-2 text-center">{travellers}</td>
              <td colSpan={2} />
              <td className="py-2 pr-2 text-right">{money(due)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
