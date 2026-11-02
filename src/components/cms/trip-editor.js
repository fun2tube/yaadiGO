"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, AlertIcon } from "@/components/icons";
import { CUTOFF_DAYS_DEFAULT } from "@/lib/inventory";

/**
 * Departures for one group trip — dates, price, batch size, minimum to run
 * and booking cut-off.
 *
 * Seats LEFT are not editable anywhere: they are derived from bookings and
 * holds (lib/inventory.js). This screen sets how big a batch is; the desk's
 * bookings decide how much of it is left. That split is what makes the old
 * failure (#130 — a stale count written back over a booking) impossible.
 *
 * Every number shown after saving is recomputed by the server.
 */

const STATUS = {
  available: ["Open", "bg-good/15 text-good"],
  filling: ["Filling", "bg-warn/20 text-warn"],
  soldout: ["Sold out", "bg-paper-line-strong text-paper-text-faint"],
  closed: ["Closed", "bg-paper-line-strong text-paper-text-muted"],
  cancelled: ["Cancelled", "bg-danger/10 text-danger"],
  completed: ["Ran", "bg-paper-line text-paper-text-faint"],
};

function money(value) {
  return `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
}

const fieldLabel = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";
const fieldInput =
  "rounded-lg border border-paper-line-strong bg-paper px-2.5 py-2 text-[13px] outline-none focus:border-accent";

function DepartureRow({ departure, onChange, onRemove }) {
  const [label, style] = STATUS[departure.status] ?? ["New", "bg-accent/15 text-accent-deep"];
  const committed = (departure.booked ?? 0) + (departure.held ?? 0);

  return (
    <div className="rounded-xl border border-paper-line bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-paper-text-faint">{departure.id}</span>
        <div className="flex items-center gap-2">
          {departure.guaranteed && (
            <span className="rounded bg-good/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-good">
              Guaranteed
            </span>
          )}
          <span className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${style}`}>{label}</span>
          <button
            type="button"
            onClick={onRemove}
            disabled={committed > 0}
            title={committed > 0 ? "People are booked or held on this batch" : undefined}
            className="rounded px-1.5 py-0.5 text-[11px] font-bold text-paper-text-faint hover:text-danger disabled:opacity-30"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Start</span>
          <input type="date" value={departure.start} onChange={(e) => onChange({ start: e.target.value })} className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>End</span>
          <input type="date" value={departure.end} onChange={(e) => onChange({ end: e.target.value })} className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Price / person</span>
          <input type="number" min="0" inputMode="numeric" value={departure.price} onChange={(e) => onChange({ price: Number(e.target.value) || 0 })} className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Total seats</span>
          <input
            type="number"
            min={committed}
            inputMode="numeric"
            value={departure.capacity}
            onChange={(e) => onChange({ capacity: Number(e.target.value) || 0 })}
            className={fieldInput}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Minimum to run</span>
          <input type="number" min="0" inputMode="numeric" value={departure.minToRun ?? 0} onChange={(e) => onChange({ minToRun: Number(e.target.value) || 0 })} className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Close days before</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={departure.cutoffDays ?? CUTOFF_DAYS_DEFAULT}
            onChange={(e) => onChange({ cutoffDays: Number(e.target.value) || 0 })}
            className={fieldInput}
          />
        </label>
      </div>

      {departure.status && (
        <p className="mt-2 text-[12px] text-paper-text-muted">
          <span className="font-semibold text-paper-text">{departure.seatsLeft ?? 0} left</span> ·{" "}
          {departure.booked ?? 0} booked · {departure.held ?? 0} held
          {departure.cutoffDate ? ` · bookings close ${departure.cutoffDate}` : ""}
        </p>
      )}
    </div>
  );
}

const editable = (d) => ({
  id: d.id,
  start: d.start,
  end: d.end,
  price: Number(d.price),
  capacity: Number(d.capacity),
  minToRun: Number(d.minToRun ?? 0),
  cutoffDays: Number(d.cutoffDays ?? CUTOFF_DAYS_DEFAULT),
});

/**
 * `departuresOnly` is the mode the full trip editor uses: title and
 * visibility belong to the trip record there (Publish / Archive), so they are
 * never sent from here.
 */
export function TripPanel({ trip, onSaved, departuresOnly = false }) {
  const [departures, setDepartures] = useState(trip.departures);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const dirty =
    JSON.stringify(departures.map(editable)) !== JSON.stringify(trip.departures.map(editable));

  const upcoming = departures.filter((d) => d.status !== "completed" && d.status !== "cancelled");
  const fromPrice = upcoming.length ? Math.min(...upcoming.map((d) => d.price)) : 0;

  function patchDeparture(index, patch) {
    setDepartures((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addDeparture() {
    const today = new Date();
    const start = new Date(today.getTime() + 45 * 86400000).toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 51 * 86400000).toISOString().slice(0, 10);
    setDepartures((prev) => [
      ...prev,
      {
        // Unique across trips: the `departures` table's id is global.
        id: `${trip.slug.slice(0, 24)}-${Date.now().toString(36)}`,
        start,
        end,
        price: fromPrice || 25000,
        capacity: 12,
        minToRun: 0,
        cutoffDays: CUTOFF_DAYS_DEFAULT,
      },
    ]);
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/trips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: trip.slug, departures: departures.map(editable) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ kind: "error", message: data.message });
        return;
      }
      setStatus({ kind: "ok", message: "Saved and live" });
      onSaved?.();
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-paper-line px-4 py-4">
      <div className="flex items-center justify-between">
        <span className={fieldLabel}>Departures ({departures.length})</span>
        <button
          type="button"
          onClick={addDeparture}
          className="rounded-lg border border-paper-line-strong px-2.5 py-1 text-[12px] font-bold text-paper-text-muted hover:border-accent hover:text-accent-deep"
        >
          + Add batch
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {departures.map((departure, index) => (
          <DepartureRow
            key={departure.id}
            departure={departure}
            onChange={(patch) => patchDeparture(index, patch)}
            onRemove={() => setDepartures((prev) => prev.filter((_, i) => i !== index))}
          />
        ))}
        {departures.length === 0 && (
          <p className="rounded-xl border border-dashed border-paper-line-strong p-5 text-center text-[12.5px] text-paper-text-muted">
            No departures yet. Add a batch — the trip shows “dates coming soon” until you do.
          </p>
        )}
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-paper-dim p-3">
        {[
          ["From price", money(fromPrice)],
          ["Open batches", departures.filter((d) => d.bookable).length],
          ["Seats still open", departures.filter((d) => d.bookable).reduce((n, d) => n + Number(d.seatsLeft || 0), 0)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className={fieldLabel}>{label}</dt>
            <dd className="mt-0.5 text-[14px] font-bold text-paper-text">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 text-[11.5px] leading-relaxed text-paper-text-faint">
        “Total seats” is the size of the batch. Seats left are worked out from confirmed bookings and
        holds, so they cannot be typed in — to sell or hold a seat, use the Departures board.
      </p>

      {status && (
        <p className={`mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold ${status.kind === "ok" ? "text-good" : "text-danger"}`}>
          {status.kind === "ok" ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
          {status.message}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="flex-1 rounded-xl bg-accent px-5 py-3 text-[14px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : dirty ? "Save departures" : "No changes"}
        </button>
        {!departuresOnly && (
          <Link
            href={`/group-tours/${trip.slug}`}
            className="rounded-xl border border-paper-line-strong px-4 py-3 text-[13px] font-semibold text-paper-text-muted"
          >
            View
          </Link>
        )}
        <Link
          href="/admin/departures"
          className="rounded-xl border border-paper-line-strong px-4 py-3 text-[13px] font-semibold text-paper-text-muted"
        >
          Board
        </Link>
      </div>
    </div>
  );
}
