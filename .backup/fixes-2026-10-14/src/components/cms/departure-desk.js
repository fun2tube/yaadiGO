"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HOLD_HOURS } from "@/lib/inventory";
import { DEPARTURE_STATUS } from "@/components/cms/departure-board";
import { AlertIcon, CheckIcon, WhatsAppIcon } from "@/components/icons";

/**
 * One departure, worked from a phone: its seats, the people on it, the seats
 * being held for leads, and the queue waiting for a seat.
 *
 * Every action posts to /api/admin/departures, which re-checks permissions
 * and runs under the trip's lock — the buttons shown here are a convenience,
 * not the control.
 */

const input =
  "w-full rounded-xl border border-paper-line-strong bg-paper px-3 py-2.5 text-[14px] text-paper-text outline-none focus:border-accent";
const ghost =
  "rounded-lg border border-paper-line-strong px-2.5 py-1.5 text-[12px] font-bold text-paper-text-muted hover:border-accent hover:text-accent-deep disabled:opacity-40";

const money = (n) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
const when = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const wa = (phone, text) => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return full ? `https://wa.me/${full}?text=${encodeURIComponent(text)}` : null;
};

function Section({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-paper-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-paper-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DepartureDesk({ trip, departure: d, bookings, holds, waitlist, canSell, canManage }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [holding, setHolding] = useState(false);
  const [form, setForm] = useState({ seats: 2, name: "", phone: "", note: "" });
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [label, style] = DEPARTURE_STATUS[d.status] ?? DEPARTURE_STATUS.available;
  const activeHolds = holds.filter((h) => h.active);
  const pastHolds = holds.filter((h) => !h.active);
  const onBatch = bookings.filter((b) => b.holdsSeats);
  const requests = bookings.filter((b) => !b.holdsSeats && b.status !== "cancelled");
  const waiting = waitlist.filter((w) => w.status === "waiting" || w.status === "offered");
  const filled = d.capacity ? Math.min(100, Math.round(((d.booked + d.held) / d.capacity) * 100)) : 0;
  const minMark = d.capacity && d.minToRun ? Math.min(100, Math.round((d.minToRun / d.capacity) * 100)) : null;

  async function post(action, body, ok) {
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/departures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tripSlug: trip.slug, departureId: d.id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice({ kind: "error", message: data.message });
        return false;
      }
      setNotice({ kind: "ok", message: ok });
      router.refresh();
      return true;
    } catch {
      setNotice({ kind: "error", message: "Couldn't reach the server. Nothing was changed." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${style}`}>{label}</span>
          {d.guaranteed && <span className="rounded bg-good/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-good">Guaranteed</span>}
          {d.atRisk && <span className="rounded bg-warn/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-warn">Short of minimum</span>}
        </div>
        <h1 className="mt-2 font-display text-[24px] font-bold leading-tight tracking-tight text-paper-text">{trip.title}</h1>
        <p className="mt-0.5 text-[14px] font-semibold text-paper-text-muted">
          {d.label} · {money(d.price)} per person
        </p>
        <p className="mt-0.5 text-[12.5px] text-paper-text-faint">
          {d.status === "closed" || d.status === "completed" || d.status === "cancelled"
            ? "Not taking bookings."
            : `Bookings close ${d.cutoffDate}.`}
        </p>
      </header>

      {notice && (
        <p className={`flex items-start gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold ${notice.kind === "ok" ? "bg-good/10 text-good" : "bg-danger/10 text-danger"}`}>
          {notice.kind === "ok" ? <CheckIcon size={14} /> : <AlertIcon size={14} />}
          {notice.message}
        </p>
      )}

      {/* Seats at a glance */}
      <section className="rounded-2xl border border-paper-line bg-card p-4 sm:p-5">
        <dl className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Seats", d.capacity],
            ["Booked", d.booked],
            ["Held", d.held],
            ["Left", d.seatsLeft],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-paper-dim py-2.5">
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">{k}</dt>
              <dd className="font-display text-[22px] font-black text-paper-text">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-paper-dim" aria-hidden="true">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${filled}%` }} />
          {minMark !== null && <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${minMark}%` }} />}
        </div>
        {d.minToRun > 0 && (
          <p className="mt-1.5 text-[12px] text-paper-text-muted">
            Runs with {d.minToRun} booked — {d.guaranteed ? "minimum reached." : `${Math.max(0, d.minToRun - d.booked)} more needed.`}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/admin/departures/${trip.slug}/${d.id}/manifest`} className={ghost}>
            Traveller list (print)
          </Link>
          <Link href={`/admin/trips/${trip.slug}`} className={ghost}>
            Edit trip & batch size
          </Link>
          {trip.listed && (
            <Link href={`/group-tours/${trip.slug}`} target="_blank" className={ghost}>
              Public page ↗
            </Link>
          )}
        </div>
      </section>

      {/* Holds */}
      <Section
        title={`Seats on hold (${activeHolds.reduce((n, h) => n + h.seats, 0)})`}
        action={
          canSell && d.bookable && !holding ? (
            <button type="button" className={ghost} onClick={() => setHolding(true)}>
              + Hold seats
            </button>
          ) : null
        }
      >
        {holding && (
          <form
            className="mb-3 flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await post(
                "hold",
                { seats: Number(form.seats), name: form.name, phone: form.phone, note: form.note },
                `Held ${form.seats} seat${Number(form.seats) === 1 ? "" : "s"} for ${form.name} for ${HOLD_HOURS} hours.`
              );
              if (ok) {
                setHolding(false);
                setForm({ seats: 2, name: "", phone: "", note: "" });
              }
            }}
          >
            <p className="text-[12.5px] text-paper-text-muted">
              Takes the seats off sale for {HOLD_HOURS} hours. They come back on their own if the hold
              is not confirmed.
            </p>
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <input aria-label="Seats" type="number" min={1} max={Math.max(1, d.seatsLeft)} inputMode="numeric" className={input} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
              <input aria-label="Name" required placeholder="Customer name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <input aria-label="Phone" type="tel" placeholder="Phone (for the WhatsApp reminder)" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input aria-label="Note" placeholder="Note (optional)" className={input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div className="flex gap-2">
              <button type="submit" disabled={Boolean(busy)} className="flex-1 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white disabled:opacity-50">
                {busy === "hold" ? "Holding…" : "Hold seats"}
              </button>
              <button type="button" onClick={() => setHolding(false)} className="rounded-xl border border-paper-line-strong px-4 py-3 text-[13.5px] font-semibold text-paper-text-muted">
                Cancel
              </button>
            </div>
          </form>
        )}

        {activeHolds.length === 0 && !holding && (
          <p className="text-[13px] text-paper-text-muted">
            No seats held. Hold seats for a lead who is deciding, so nobody else books them meanwhile.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {activeHolds.map((h) => {
            const link = wa(h.phone, `Hi ${h.name}, your ${h.seats} seat${h.seats === 1 ? " is" : "s are"} held on ${trip.title} (${d.label}) until ${when(h.expiresAt)}. Shall I confirm?`);
            return (
              <li key={h.id} className="rounded-xl border border-paper-line p-3">
                <p className="text-[14px] font-bold text-paper-text">
                  {h.seats} seat{h.seats === 1 ? "" : "s"} · {h.name}
                </p>
                <p className="text-[12px] text-paper-text-muted">
                  Held by {h.heldByName ?? "—"} · expires {when(h.expiresAt)}
                  {h.note ? ` · ${h.note}` : ""}
                </p>
                {canSell && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" disabled={Boolean(busy)} className={ghost} onClick={() => post("convert", { holdId: h.id }, `Confirmed ${h.name} as a booking.`)}>
                      Confirm as booking
                    </button>
                    <button type="button" disabled={Boolean(busy)} className={ghost} onClick={() => post("release", { holdId: h.id }, "Hold released — seats back on sale.")}>
                      Release
                    </button>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className={`${ghost} inline-flex items-center gap-1`}>
                        <WhatsAppIcon size={12} /> Remind
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {pastHolds.length > 0 && (
          <p className="mt-2 text-[11.5px] text-paper-text-faint">
            {pastHolds.length} earlier hold{pastHolds.length === 1 ? "" : "s"} (released, expired or confirmed).
          </p>
        )}
      </Section>

      {/* Bookings */}
      <Section title={`Booked (${onBatch.reduce((n, b) => n + b.travellers, 0)} travellers)`}>
        {onBatch.length === 0 && <p className="text-[13px] text-paper-text-muted">Nobody confirmed on this batch yet.</p>}
        <ul className="flex flex-col gap-1.5">
          {onBatch.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-paper-dim px-3 py-2.5 text-[13px]">
                <span className="min-w-0">
                  <span className="block truncate font-bold text-paper-text">{b.name ?? "—"} · {b.travellers}</span>
                  <span className="text-paper-text-muted">{b.reference} · {b.status}</span>
                </span>
                <span className="shrink-0 text-right text-[12px] text-paper-text-muted">
                  {money(b.collected)} of {money(b.total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {requests.length > 0 && (
          <p className="mt-2 text-[12px] text-paper-text-muted">
            {requests.length} request{requests.length === 1 ? "" : "s"} not yet confirmed (no seats taken) —{" "}
            <Link href="/admin/bookings" className="font-semibold text-accent-deep">open the bookings board</Link>.
          </p>
        )}
      </Section>

      {/* Waitlist */}
      <Section title={`Waitlist (${waiting.length})`}>
        {waiting.length === 0 ? (
          <p className="text-[13px] text-paper-text-muted">
            Nobody waiting. When this batch is full, the trip page offers a waitlist and names land here.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {waiting.map((w, i) => {
              const link = wa(w.phone, `Hi ${w.name}, a seat has opened on ${trip.title} (${d.label}). Would you like it? It is yours for the next few hours.`);
              return (
                <li key={w.id} className="rounded-xl border border-paper-line p-3">
                  <p className="text-[14px] font-bold text-paper-text">
                    {i + 1}. {w.name} · {w.travellers} traveller{w.travellers === 1 ? "" : "s"}
                    {w.status === "offered" && <span className="ml-2 rounded bg-warn/20 px-1.5 py-0.5 font-mono text-[9.5px] text-warn">OFFERED</span>}
                  </p>
                  <p className="text-[12px] text-paper-text-muted">{w.phone} · joined {when(w.createdAt)}</p>
                  {canSell && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className={`${ghost} inline-flex items-center gap-1`}>
                          <WhatsAppIcon size={12} /> Offer the seat
                        </a>
                      )}
                      {w.status === "waiting" && (
                        <button type="button" disabled={Boolean(busy)} className={ghost} onClick={() => post("waitlist", { id: w.id, status: "offered" }, `Marked ${w.name} as offered.`)}>
                          Mark offered
                        </button>
                      )}
                      <button type="button" disabled={Boolean(busy)} className={ghost} onClick={() => post("waitlist", { id: w.id, status: "booked" }, `${w.name} marked as booked.`)}>
                        Booked
                      </button>
                      <button type="button" disabled={Boolean(busy)} className={ghost} onClick={() => post("waitlist", { id: w.id, status: "removed" }, `${w.name} removed from the waitlist.`)}>
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {waiting.length > 0 && (
          <p className="mt-2 text-[11.5px] text-paper-text-faint">
            First come, first offered. To give someone a seat, hold it for them above, then confirm.
          </p>
        )}
      </Section>

      {/* The batch itself */}
      {canManage && d.status !== "completed" && d.status !== "cancelled" && (
        <Section title="This batch">
          <div className="flex flex-wrap gap-2">
            {d.closed ? (
              <button type="button" disabled={Boolean(busy)} className={ghost} onClick={() => post("reopen", {}, "Bookings reopened.")}>
                Reopen bookings
              </button>
            ) : (
              <button type="button" disabled={Boolean(busy)} className={ghost} onClick={() => post("close", {}, "Bookings closed for this batch.")}>
                Close bookings now
              </button>
            )}
            {!confirmCancel ? (
              <button type="button" className={`${ghost} text-danger`} onClick={() => setConfirmCancel(true)}>
                Cancel this departure…
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="text-paper-text-muted">Call off this batch? It disappears from the site.</span>
                <button type="button" disabled={Boolean(busy)} className="font-bold text-danger underline" onClick={async () => { if (await post("cancel", {}, "Departure cancelled.")) setConfirmCancel(false); }}>
                  Yes, cancel it
                </button>
                <button type="button" className="font-semibold text-paper-text-muted" onClick={() => setConfirmCancel(false)}>
                  Keep it
                </button>
              </span>
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-paper-text-faint">
            A batch with anyone booked or held cannot be cancelled — move or cancel them first.
            Bookings also close by themselves {d.cutoffDays} days before departure.
          </p>
        </Section>
      )}
    </div>
  );
}
