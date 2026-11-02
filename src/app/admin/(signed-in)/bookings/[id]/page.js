import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { getBookingFor } from "@/lib/cms/bookings";
import { paymentsFor } from "@/lib/crm/payments";
import { whatsappTo } from "@/lib/crm/messages";
import { servicesFor } from "@/lib/crm/operations";
import { timelineFor } from "@/lib/crm/events";
import { listUsers } from "@/lib/cms/users";
import { userCan, money, BOOKING_STAGES, TONE_CLASSES, bookingHoldsSeats } from "@/lib/crm/schema";
import ServiceList from "@/components/cms/service-list";
import HandoverButton from "@/components/cms/handover-button";
import PaymentLinkButton from "@/components/cms/payment-link-button";
import RecordPayment from "@/components/cms/record-payment";
import { WhatsAppIcon } from "@/components/icons";

export const metadata = { title: "Booking" };
export const dynamic = "force-dynamic";

/**
 * One booking, two audiences.
 *
 * Sales sees the money; ops sees the services. Both see the customer, the trip
 * and the history. A separate ops-only page would mean two places to look for
 * the same booking, and sooner or later they would disagree about it.
 */
export default async function BookingPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const { id } = await params;
  // Scoped: someone else's booking is a 404 to a salesperson, not a page
  // (F6, review 2026-10-14-full-function-test).
  const booking = await getBookingFor(user, id);
  if (!booking) notFound();

  const [services, timeline, staff, payments] = await Promise.all([
    servicesFor(id),
    timelineFor({ bookingId: id }),
    listUsers(),
    paymentsFor(id),
  ]);

  const byId = new Map(staff.map((u) => [u.id, u]));
  const stage = BOOKING_STAGES.find((s) => s.value === booking.status) ?? BOOKING_STAGES[0];
  const outstanding = Math.max(0, (booking.total ?? 0) - (booking.collected ?? 0));

  const canOperate = userCan(user, "services.write");
  const canSell = userCan(user, "bookings.write");
  // A website seat request nobody has confirmed: confirming is what holds the
  // seats, so money waits for it (lib/crm/payments.js).
  const needsConfirmation =
    Boolean(booking.departureId) && !bookingHoldsSeats(booking.status) && booking.status !== "cancelled";
  const whatsapp = whatsappTo(booking.phone);

  return (
    <>
      <header className="mb-4">
        <Link
          href={canOperate ? "/admin/operations" : "/admin/bookings"}
          className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text"
        >
          ← {canOperate ? "Operations" : "Bookings"}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[24px] font-bold tracking-tight text-paper-text">
            {booking.name ?? "—"}
          </h1>
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${TONE_CLASSES[stage.tone]}`}
          >
            {stage.label}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[11.5px] text-paper-text-faint">
          {booking.reference} · {booking.tripTitle} · {booking.travellers} travellers
        </p>
      </header>

      {/* Contact first — the desk is usually here because they need to ring. */}
      <div className="flex flex-wrap gap-2">
        {booking.phone && (
          <>
            <a
              href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`}
              className="rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-ink-text"
            >
              Call {booking.phone}
            </a>
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-[12.5px] font-bold text-white"
              >
                <WhatsAppIcon size={13} /> WhatsApp
              </a>
            )}
          </>
        )}
        {booking.email && (
          <a
            href={`mailto:${booking.email}`}
            className="rounded-lg border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-semibold text-paper-text-muted"
          >
            Email
          </a>
        )}
      </div>

      {/* Money */}
      <section className="mt-5 rounded-2xl border border-paper-line bg-card p-4">
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-paper-text-muted">Total</dt>
            <dd className="font-semibold text-paper-text">{money(booking.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-paper-text-muted">Collected</dt>
            <dd className="font-semibold text-good">{money(booking.collected ?? 0)}</dd>
          </div>
          <div className="flex justify-between border-t border-paper-line pt-1.5">
            <dt className="font-bold text-paper-text">Outstanding</dt>
            <dd
              className={`font-display text-[17px] font-bold ${
                outstanding > 0 ? "text-warn" : "text-good"
              }`}
            >
              {money(outstanding)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 border-t border-paper-line pt-2.5 font-mono text-[10.5px] text-paper-text-faint">
          Sales: {byId.get(booking.salesOwnerId)?.name ?? "unassigned"}
          {booking.handedToOpsAt
            ? ` · Ops: ${byId.get(booking.opsOwnerId)?.name ?? "unassigned"}`
            : " · not yet with operations"}
        </p>
      </section>

      {/* Collecting comes BEFORE the handover in the page order, because it
          comes before it in the process: operations should not pick up a trip
          that has not been paid for. */}
      {canSell && !needsConfirmation && booking.status !== "cancelled" && (
        <div className="mt-4">
          <PaymentLinkButton booking={booking} outstanding={outstanding} me={user} />
        </div>
      )}

      {/* Money that arrived any other way — bank transfer, GPay, cash — and
          the ledger. Read-only for anyone who cannot sell. */}
      {(canSell || payments.length > 0) && (
        <div className="mt-4">
          <RecordPayment
            booking={booking}
            outstanding={outstanding}
            needsConfirmation={needsConfirmation || !canSell}
            readOnly={!canSell}
            payments={payments}
          />
        </div>
      )}

      {canSell && !booking.handedToOpsAt && (
        <div className="mt-4">
          <HandoverButton booking={booking} outstanding={outstanding} staff={staff} />
        </div>
      )}

      <div className="mt-6">
        <ServiceList bookingId={id} initialServices={services} canEdit={canOperate} />
      </div>

      {/* History */}
      {timeline.length > 0 && (
        <section className="mt-7">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            History
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {timeline.map((event) => (
              <li key={event.id} className="flex gap-3 text-[12.5px]">
                <span className="w-[74px] shrink-0 font-mono text-[10px] text-paper-text-faint">
                  {new Date(event.at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="min-w-0 text-paper-text-muted">
                  <strong className="font-semibold text-paper-text">{event.type}</strong>
                  {event.payload?.summary ? ` — ${event.payload.summary}` : ""}
                  {event.actorName ? ` (${event.actorName})` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
