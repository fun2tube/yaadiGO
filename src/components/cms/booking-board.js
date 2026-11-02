"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  ChevronIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { whatsappTo } from "@/lib/crm/messages";

/**
 * The bookings board.
 *
 * A booking here is a seat request the desk works by hand, and the board is
 * arranged around the two things that go wrong: a batch leaving with unsettled
 * money, and a batch that has been over-promised. So it sorts by departure
 * date — soonest first — and shows what a confirmation will actually do to the
 * seat count before anyone taps it.
 *
 * Confirming is the only action that moves stock. It is deliberately a
 * two-tap, explained action rather than a quiet toggle.
 */

/**
 * Every status a booking can be in, for display.
 *
 * `manual` marks the ones a person sets with a tap. The money stages
 * (part-paid, paid) are NOT manual: the stage follows the ledger
 * (lib/crm/payments.js). This board used to offer an "Advance paid" button
 * that set `paid` — which the rest of the system reads as PAID IN FULL — on a
 * booking with nothing recorded against it, and sent it to operations as
 * settled (found 2026-10-14). Money is recorded on the booking page.
 */
const STATUSES = [
  {
    value: "requested",
    label: "Requested",
    className: "bg-accent/15 text-accent-deep",
    holds: false,
    manual: true,
  },
  { value: "confirmed", label: "Confirmed", className: "bg-warn/20 text-warn", holds: true, manual: true },
  { value: "part-paid", label: "Part paid", className: "bg-warn/20 text-warn", holds: true },
  { value: "paid", label: "Paid in full", className: "bg-good/15 text-good", holds: true },
  {
    value: "in-progress",
    label: "Travelling",
    className: "bg-good/15 text-good",
    holds: true,
    manual: true,
  },
  {
    value: "completed",
    label: "Travelled",
    className: "bg-paper-line-strong text-paper-text-muted",
    holds: true,
    manual: true,
  },
  {
    value: "cancelled",
    label: "Cancelled",
    className: "bg-danger/10 text-danger",
    holds: false,
    manual: true,
  },
];

// Still being worked by sales: part-paid counts — the balance is still owed.
const OPEN = new Set(["requested", "confirmed", "part-paid"]);

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "requested", label: "To confirm" },
  { value: "confirmed", label: "Awaiting payment" },
  { value: "all", label: "All" },
];

function money(value) {
  return `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
}

function meta(status) {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[0];
}

/** Days until departure, as a phrase the desk reads rather than a number. */
function countdown(iso) {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "departed", urgent: false };
  if (days === 0) return { label: "leaves today", urgent: true };
  if (days === 1) return { label: "leaves tomorrow", urgent: true };
  if (days <= 14) return { label: `in ${days} days`, urgent: true };
  return { label: `in ${days} days`, urgent: false };
}

function StatusPill({ status }) {
  const m = meta(status);
  return (
    <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${m.className}`}>
      {m.label}
    </span>
  );
}

function BookingCard({ booking, onPatch, busy, error }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const m = meta(booking.status);
  const clock = countdown(booking.departureStart);

  return (
    <article className="overflow-hidden rounded-2xl border border-paper-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-paper-text">{booking.name ?? "—"}</span>
            <StatusPill status={booking.status} />
            {/* Only a fixed-departure booking holds seats; an approved
                quotation has no batch, and "2 seats held" on one was
                holding nothing. */}
            {m.holds && booking.departureId && (
              <span className="rounded-md bg-ink/8 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-paper-text-muted">
                {booking.travellers} seat{booking.travellers === 1 ? "" : "s"} held
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[13px] font-semibold text-paper-text-muted">
            {booking.tripTitle}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-paper-text-faint">
            {/* The reference was missing from this list entirely, and it is
                the handle everyone outside sales actually uses — it is what
                goes in a supplier email, what accounts quotes on an invoice,
                and what a customer reads back down the phone. Finding a
                booking meant opening it. */}
            {booking.reference && (
              <span className="font-bold text-paper-text-muted">{booking.reference}</span>
            )}
            <span className="flex items-center gap-1">
              <CalendarIcon size={11} /> {booking.departureLabel}
            </span>
            {clock && (
              <>
                <span aria-hidden="true">·</span>
                <span className={clock.urgent ? "font-bold text-warn" : ""}>{clock.label}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-display text-[16px] font-bold text-paper-text">
            {money(booking.total)}
          </span>
          <ChevronIcon
            size={14}
            className={`text-paper-text-faint transition-transform ${open ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {/* Calling is the job — the number never hides behind a tap. */}
      <div className="flex flex-wrap gap-2 border-t border-paper-line px-4 py-2.5">
        {booking.phone && (
          <>
            <a
              href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`}
              className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-ink-text"
            >
              Call {booking.phone}
            </a>
            <a
              href={whatsappTo(booking.phone) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[12px] font-bold text-white"
            >
              <WhatsAppIcon size={13} /> WhatsApp
            </a>
          </>
        )}
        {booking.email && (
          <a
            href={`mailto:${booking.email}`}
            className="rounded-lg border border-paper-line-strong px-3 py-1.5 text-[12px] font-semibold text-paper-text-muted"
          >
            Email
          </a>
        )}
      </div>

      {open && (
        <div className="border-t border-paper-line px-4 py-3.5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
            {[
              ["Travellers", booking.travellers],
              ["Room", booking.sharing],
              ["Joining from", booking.pickup],
              ["Per person", money(booking.perPerson)],
              ["Advance due", money(booking.advance)],
              ["Balance", money(booking.balance)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                  {label}
                </dt>
                <dd className="mt-0.5 font-semibold text-paper-text">{value}</dd>
              </div>
            ))}
          </dl>

          {/* What confirming will do, said before it is done. */}
          {booking.status === "requested" && (
            <div className="mt-3.5 rounded-xl border border-warn/40 bg-warn/8 p-3">
              {confirming ? (
                <>
                  {booking.departureId ? (
                    <>
                      <p className="text-[12.5px] font-bold text-paper-text">
                        Take {booking.travellers} seat{booking.travellers === 1 ? "" : "s"} off this
                        batch?
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-paper-text-muted">
                        The website stops offering them immediately. Cancelling later puts them
                        back.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[12.5px] font-bold text-paper-text">
                        Hotels and transport available on their dates?
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-paper-text-muted">
                        Confirming tells the desk to take the {money(booking.advance)} advance.
                      </p>
                    </>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setConfirming(false);
                        onPatch(booking.id, { status: "confirmed" });
                      }}
                      className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
                    >
                      {booking.departureId ? "Yes, hold the seats" : "Yes, confirm it"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="rounded-lg border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-semibold text-paper-text-muted"
                    >
                      Not yet
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-bold text-white"
                >
                  <CheckIcon size={13} />{" "}
                  {booking.departureId ? "Confirm and hold seats" : "Confirm the booking"}
                </button>
              )}
            </div>
          )}

          {/* The rest of the lifecycle, one tap each. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUSES.filter(
              (s) =>
                (s.manual || s.value === booking.status) &&
                !(s.value === "confirmed" && booking.status === "requested")
            )
              .map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={busy || option.value === booking.status}
                  onClick={() => onPatch(booking.id, { status: option.value })}
                  className={`rounded-lg px-2.5 py-1.5 font-mono text-[10.5px] font-bold transition-all disabled:opacity-100 ${
                    option.value === booking.status
                      ? option.className
                      : "border border-paper-line-strong text-paper-text-muted hover:border-accent hover:text-accent-deep"
                  }`}
                >
                  {option.label}
                </button>
              ))}
          </div>

          {error && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
              <AlertIcon size={13} /> {error}
            </p>
          )}

          {booking.notes?.length > 0 && (
            <ul className="mt-3.5 flex flex-col gap-2 border-t border-paper-line pt-3">
              {booking.notes.map((entry) => (
                <li key={entry.at} className="text-[12.5px] leading-relaxed text-paper-text-muted">
                  <span className="font-mono text-[10px] text-paper-text-faint">
                    {new Date(entry.at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>{" "}
                  {entry.body}
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim()) return;
              onPatch(booking.id, { note: note.trim() });
              setNote("");
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              className="flex-1 rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !note.trim()}
              className="rounded-lg border border-paper-line-strong px-3 py-2 text-[12.5px] font-bold text-paper-text-muted disabled:opacity-40"
            >
              Save
            </button>
          </form>

          {booking.leadId && (
            <Link
              href="/admin/leads"
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-deep"
            >
              Open the enquiry <ChevronIcon size={11} />
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export default function BookingBoard({ bookings: initial }) {
  const [bookings, setBookings] = useState(initial);
  const [filter, setFilter] = useState("open");
  const [busyId, setBusyId] = useState(null);
  const [errors, setErrors] = useState({});

  /**
   * Advance money still to come in.
   *
   * This used to sum `advance` across every confirmed booking and ignore
   * `collected` altogether, so a booking whose advance had been paid in full
   * still counted as outstanding. The headline figure on this board — the one
   * the desk reads first every morning — therefore overstated what was owed,
   * and never went down when somebody paid.
   *
   * Clamped at zero per booking: an overpayment on one trip is not a credit
   * against another, and netting it off would hide both.
   */
  const awaiting = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "confirmed")
        .reduce((sum, b) => sum + Math.max(0, (b.advance ?? 0) - (b.collected ?? 0)), 0),
    [bookings]
  );

  const counts = useMemo(() => {
    const open = bookings.filter((b) => OPEN.has(b.status));
    return {
      open: open.length,
      requested: bookings.filter((b) => b.status === "requested").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      all: bookings.length,
    };
  }, [bookings]);

  const visible = bookings.filter((b) => {
    if (filter === "all") return true;
    if (filter === "open") return OPEN.has(b.status);
    return b.status === filter;
  });

  /**
   * Patch in place rather than refetch. The desk is usually on a phone with a
   * poor connection — re-pulling the whole board to show one changed pill is
   * the difference between instant and "did that work?".
   */
  async function patch(id, body) {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: null }));
    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors((prev) => ({ ...prev, [id]: data.message ?? "That didn't save." }));
        return;
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? data.booking : b)));
    } catch {
      setErrors((prev) => ({ ...prev, [id]: "Couldn't reach the server." }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {awaiting > 0 && (
        <div className="mb-4 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3.5">
          <p className="font-display text-[22px] font-bold leading-none text-paper-text">
            {money(awaiting)}
          </p>
          <p className="mt-1 text-[12.5px] text-paper-text-muted">
            advance confirmed but not yet received
          </p>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
              filter === option.value
                ? "border-ink bg-ink text-ink-text"
                : "border-paper-line-strong bg-card text-paper-text-muted"
            }`}
          >
            {option.label}
            <span className="font-mono text-[10px] opacity-70">{counts[option.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-paper-line-strong p-10 text-center text-[13.5px] text-paper-text-muted">
          {bookings.length === 0
            ? "No seat requests yet. They arrive here the moment someone reserves on a trip page."
            : "Nothing in this view."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {visible.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onPatch={patch}
              busy={busyId === booking.id}
              error={errors[booking.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
