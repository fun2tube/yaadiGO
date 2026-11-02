import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { buildOpsBoard } from "@/lib/crm/operations";
import { userCan, money } from "@/lib/crm/schema";
import { ChevronIcon, AlertIcon } from "@/components/icons";

export const metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

function countdown(days) {
  if (days === null) return { text: "no date set", urgent: false };
  if (days < 0) return { text: "departed", urgent: false };
  if (days === 0) return { text: "departs today", urgent: true };
  if (days === 1) return { text: "departs tomorrow", urgent: true };
  return { text: `in ${days} days`, urgent: days <= 14 };
}

function BookingCard({ booking }) {
  const clock = countdown(booking.daysToGo);
  const { progress } = booking;

  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="block rounded-2xl border border-paper-line bg-card px-4 py-3.5 transition-colors hover:border-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-bold text-paper-text">
            {booking.name ?? "—"}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-paper-text-muted">
            {booking.tripTitle}
          </p>
          <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">
            {booking.reference} · {booking.departureLabel} ·{" "}
            <span className={clock.urgent ? "font-bold text-warn" : ""}>{clock.text}</span>
          </p>
        </div>
        <ChevronIcon size={13} className="mt-1 shrink-0 text-paper-text-faint" />
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-dim">
          <div className="h-full bg-good" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="shrink-0 font-mono text-[10.5px] text-paper-text-muted">
          {progress.confirmed}/{progress.total} arranged
        </span>
      </div>

      {/* Ops should not commit supplier spend without seeing what is unpaid.
          Not a block — sometimes you hold a hotel on trust. */}
      {booking.outstanding > 0 && (
        <p className="mt-2 font-mono text-[10.5px] font-bold text-warn">
          {money(booking.outstanding)} still outstanding
        </p>
      )}
    </Link>
  );
}

function Group({ title, bookings, tone }) {
  if (bookings.length === 0) return null;
  return (
    <section className="mt-6 first:mt-0">
      <h2
        className={`font-mono text-[9.5px] uppercase tracking-[0.12em] ${
          tone === "warn" ? "text-warn" : "text-paper-text-faint"
        }`}
      >
        {title} · {bookings.length}
      </h2>
      <div className="mt-2 flex flex-col gap-2.5">
        {bookings.map((b) => (
          <BookingCard key={b.id} booking={b} />
        ))}
      </div>
    </section>
  );
}

export default async function OperationsPage() {
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const board = await buildOpsBoard();

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Operations
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Bookings handed over by sales, soonest departure first.
        </p>
      </header>

      {board.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-paper-line-strong p-10 text-center text-[13.5px] leading-relaxed text-paper-text-muted">
          Nothing handed over yet. Bookings appear here once sales hands them to
          operations.
        </p>
      ) : (
        <>
          {board.needsAttention.length > 0 && (
            <div className="mb-5 flex items-start gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
              <span className="mt-0.5 shrink-0 text-warn">
                <AlertIcon size={14} />
              </span>
              <p className="text-[13px] leading-snug text-paper-text">
                <strong className="font-bold">{board.needsAttention.length}</strong> departing
                within two weeks with things still unbooked.
              </p>
            </div>
          )}

          <Group title="No travel dates yet" bookings={board.undated} tone="warn" />
          <Group title="Needs attention" bookings={board.needsAttention} tone="warn" />
          <Group title="In progress" bookings={board.inProgress} />
          <Group title="Upcoming" bookings={board.upcoming} />
          <Group title="Travelling and done" bookings={board.travelling} />
        </>
      )}
    </>
  );
}
