"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HOTEL_CATEGORIES,
  MEAL_PLANS,
  ROOM_CLASSES,
  OCCUPANCIES,
  TRANSPORT_MODES,
  normaliseBrief,
  emptyRoom,
  childBand,
  roomCapacity,
  totalTravellers,
  briefGaps,
} from "@/lib/crm/brief";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * The trip brief — what the salesperson confirms on the call.
 *
 * The whole point is that the quotation builder should never have to ask a
 * question this screen already answered. Two things follow from that:
 *
 * 1. **It saves in pieces.** A brief is filled in while the customer is still
 *    talking. Nothing is required, and a half-filled brief saves fine.
 * 2. **It says what is still missing** rather than refusing to continue.
 *    Finding out the meal plan was never captured halfway through writing a
 *    quotation is worse than knowing before you start.
 *
 * The customer's own words in `dates` and `budget` are shown but never edited
 * here — "mid-June, flexible" is evidence of what they asked for, and the
 * confirmed date belongs in its own field beside it, not on top of it.
 */

const field =
  "w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent";
const label = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";
const chip =
  "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer";

function Num({ value, onChange, min = 0, max = 99, suffix }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(Math.max(min, (Number(value) || 0) - 1))}
        className="h-8 w-8 rounded-lg border border-paper-line-strong text-[15px] leading-none hover:border-accent"
      >
        −
      </button>
      <span className="min-w-[2.2rem] text-center text-[14px] font-semibold tabular-nums">
        {Number(value) || 0}
      </span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(Math.min(max, (Number(value) || 0) + 1))}
        className="h-8 w-8 rounded-lg border border-paper-line-strong text-[15px] leading-none hover:border-accent"
      >
        +
      </button>
      {suffix ? <span className="text-[12.5px] text-paper-text-muted">{suffix}</span> : null}
    </div>
  );
}

export default function TripBrief({ lead }) {
  const [departureDate, setDepartureDate] = useState(lead.departureDate ?? "");
  const [returnDate, setReturnDate] = useState(lead.returnDate ?? "");
  const [flexible, setFlexible] = useState(Boolean(lead.departureFlexible));

  const [adults, setAdults] = useState(lead.adults ?? lead.groupSize ?? 2);
  const [children, setChildren] = useState(
    Array.isArray(lead.children) ? lead.children.map((c) => ({ age: c.age ?? 0 })) : []
  );
  const [infants, setInfants] = useState(lead.infants ?? 0);

  const [budgetAmount, setBudgetAmount] = useState(lead.budgetAmount ?? "");
  const [budgetPerPerson, setBudgetPerPerson] = useState(lead.budgetPerPerson !== false);

  const [brief, setBrief] = useState(() => normaliseBrief(lead.brief));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const patchBrief = (patch) => {
    setBrief((b) => ({ ...b, ...patch }));
    setSaved(false);
  };

  const setRoom = (i, patch) =>
    patchBrief({ rooms: brief.rooms.map((r, n) => (n === i ? { ...r, ...patch } : r)) });

  const toggleTransport = (mode) =>
    patchBrief({
      transportModes: brief.transportModes.includes(mode)
        ? brief.transportModes.filter((m) => m !== mode)
        : [...brief.transportModes, mode],
    });

  const travellers = totalTravellers({ adults, children, infants });
  const beds = roomCapacity(brief.rooms);
  // Infants share a bed, so they are excluded from the comparison — otherwise
  // every family with a baby gets a warning telling them to book another room.
  const needBeds = (Number(adults) || 0) + children.length;
  const bedMismatch = beds > 0 && needBeds > 0 && beds !== needBeds;

  const gaps = briefGaps({ brief, departureDate, adults });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/leads/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          departureDate: departureDate || null,
          returnDate: returnDate || null,
          departureFlexible: flexible,
          adults: adults === "" ? null : Number(adults),
          children: children.map((c) => ({ age: Number(c.age) || 0 })),
          infants: Number(infants) || 0,
          budgetAmount: budgetAmount === "" ? null : Number(budgetAmount),
          budgetPerPerson,
          brief,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Could not save the brief.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-paper-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[17px] font-bold">Trip brief</h2>
        <p className="text-[12px] text-paper-text-muted">
          What you confirm here is what the quotation builder uses.
        </p>
      </div>

      {/* What the customer actually typed. Read-only on purpose: it is
          evidence of the ask, not a field to correct. */}
      {(lead.dates || lead.budget || lead.message) && (
        <div className="mt-3 rounded-xl border border-paper-line bg-paper px-3.5 py-3">
          <p className={label}>In their words</p>
          <div className="mt-1.5 flex flex-col gap-0.5 text-[13px] text-paper-text-muted">
            {lead.dates ? <p>Dates — {lead.dates}</p> : null}
            {lead.budget ? <p>Budget — {lead.budget}</p> : null}
            {lead.message ? <p className="line-clamp-3">“{lead.message}”</p> : null}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- dates */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="brief-dep">
            Departure
          </label>
          <input
            id="brief-dep"
            type="date"
            className={`${field} mt-1`}
            value={departureDate}
            onChange={(e) => {
              setDepartureDate(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div>
          <label className={label} htmlFor="brief-ret">
            Return
          </label>
          <input
            id="brief-ret"
            type="date"
            className={`${field} mt-1`}
            value={returnDate}
            min={departureDate || undefined}
            onChange={(e) => {
              setReturnDate(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-[13px]">
            <input
              type="checkbox"
              checked={flexible}
              onChange={(e) => {
                setFlexible(e.target.checked);
                setSaved(false);
              }}
            />
            Dates are flexible
          </label>
        </div>
      </div>

      {/* ----------------------------------------------------- travellers */}
      <div className="mt-5">
        <p className={label}>Who is travelling</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-[12.5px] text-paper-text-muted">Adults</p>
            <div className="mt-1">
              <Num value={adults} min={1} onChange={(v) => { setAdults(v); setSaved(false); }} />
            </div>
          </div>
          <div>
            <p className="text-[12.5px] text-paper-text-muted">Infants (under 2)</p>
            <div className="mt-1">
              <Num value={infants} onChange={(v) => { setInfants(v); setSaved(false); }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setChildren([...children, { age: 8 }]); setSaved(false); }}
            className="self-end rounded-lg border border-paper-line-strong px-3 py-2 text-[13px] font-medium hover:border-accent"
          >
            + Add a child
          </button>
        </div>

        {/* An AGE per child, never a count. Two children aged 4 and 11 do not
            price the same, and the band next to each one is the reminder. */}
        {children.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {children.map((child, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] text-paper-text-muted">Child {i + 1}</span>
                <input
                  type="number"
                  min={0}
                  max={17}
                  aria-label={`Age of child ${i + 1}`}
                  className="w-20 rounded-lg border border-paper-line-strong bg-paper px-2.5 py-1.5 text-[13.5px] outline-none focus:border-accent"
                  value={child.age}
                  onChange={(e) => {
                    setChildren(children.map((c, n) => (n === i ? { age: e.target.value } : c)));
                    setSaved(false);
                  }}
                />
                <span className="text-[12px] text-paper-text-faint">
                  {childBand(child.age)?.label ?? ""}
                </span>
                <button
                  type="button"
                  onClick={() => { setChildren(children.filter((_, n) => n !== i)); setSaved(false); }}
                  className="text-[12.5px] text-paper-text-muted underline hover:text-accent-deep"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------- stay */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="brief-hotel">
            Hotel category
          </label>
          <select
            id="brief-hotel"
            className={`${field} mt-1`}
            value={brief.hotelCategory ?? ""}
            onChange={(e) => patchBrief({ hotelCategory: e.target.value || null })}
          >
            <option value="">Not decided</option>
            {HOTEL_CATEGORIES.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="brief-meal">
            Meal plan
          </label>
          <select
            id="brief-meal"
            className={`${field} mt-1`}
            value={brief.mealPlan ?? ""}
            onChange={(e) => patchBrief({ mealPlan: e.target.value || null })}
          >
            <option value="">Not decided</option>
            {MEAL_PLANS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label} ({m.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --------------------------------------------------------- rooms */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className={label}>Rooms</p>
          <button
            type="button"
            onClick={() => patchBrief({ rooms: [...brief.rooms, emptyRoom()] })}
            className="text-[12.5px] font-medium text-accent-deep underline"
          >
            + Add a room type
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {brief.rooms.map((room, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-xl border border-paper-line bg-paper p-2.5"
            >
              {/* Class and occupancy are separate controls because they are
                  separate things — "deluxe" says how good the room is,
                  "double" says how many sleep in it. */}
              <select
                aria-label={`Room ${i + 1} class`}
                className="rounded-lg border border-paper-line-strong bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
                value={room.roomClass}
                onChange={(e) => setRoom(i, { roomClass: e.target.value })}
              >
                {ROOM_CLASSES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Room ${i + 1} occupancy`}
                className="rounded-lg border border-paper-line-strong bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
                value={room.occupancy}
                onChange={(e) => setRoom(i, { occupancy: e.target.value })}
              >
                {OCCUPANCIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} · sleeps {o.sleeps}
                  </option>
                ))}
              </select>
              <div>
                <p className="text-[11px] text-paper-text-faint">Extra mattress</p>
                <Num
                  value={room.extraMattress}
                  max={4}
                  onChange={(v) => setRoom(i, { extraMattress: v })}
                />
              </div>
              <div>
                <p className="text-[11px] text-paper-text-faint">How many</p>
                <Num value={room.count} min={1} onChange={(v) => setRoom(i, { count: v })} />
              </div>
              {brief.rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => patchBrief({ rooms: brief.rooms.filter((_, n) => n !== i) })}
                  className="pb-2 text-[12.5px] text-paper-text-muted underline hover:text-accent-deep"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {/* A warning, never a block. Three adults in one triple is right;
            so is three adults in a double plus a single. Only the
            salesperson knows which. */}
        {bedMismatch && (
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-paper-text-muted">
            <AlertIcon size={13} className="mt-0.5 shrink-0" />
            {beds} {beds === 1 ? "bed" : "beds"} for {needBeds}{" "}
            {needBeds === 1 ? "traveller" : "travellers"} (infants excluded) — check this is what
            they want.
          </p>
        )}
      </div>

      {/* ----------------------------------------------------- transport */}
      <div className="mt-5">
        <p className={label}>Transport</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRANSPORT_MODES.map((mode) => {
            const on = brief.transportModes.includes(mode.value);
            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTransport(mode.value)}
                className={`${chip} ${
                  on
                    ? "border-accent bg-accent/10 text-accent-deep"
                    : "border-paper-line-strong text-paper-text-muted hover:border-accent"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* -------------------------------------------------------- budget */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="brief-budget">
            Confirmed budget (₹)
          </label>
          <input
            id="brief-budget"
            type="number"
            min={0}
            placeholder="e.g. 45000"
            className={`${field} mt-1`}
            value={budgetAmount}
            onChange={(e) => { setBudgetAmount(e.target.value); setSaved(false); }}
          />
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-[13px]">
            <input
              type="checkbox"
              checked={budgetPerPerson}
              onChange={(e) => { setBudgetPerPerson(e.target.checked); setSaved(false); }}
            />
            Per person{" "}
            <span className="text-paper-text-faint">
              {budgetPerPerson ? "" : "(total for the group)"}
            </span>
          </label>
        </div>
      </div>

      <div className="mt-4">
        <label className={label} htmlFor="brief-notes">
          Special requests
        </label>
        <textarea
          id="brief-notes"
          rows={2}
          placeholder="Ground floor room, Jain food, wheelchair access, anniversary…"
          className={`${field} mt-1 resize-y`}
          value={brief.specialRequests}
          onChange={(e) => patchBrief({ specialRequests: e.target.value })}
        />
      </div>

      {/* ---------------------------------------------------------- save */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-4">
        <div className="text-[12.5px]">
          {gaps.length === 0 ? (
            <p className="flex items-center gap-1.5 text-paper-text-muted">
              <CheckIcon size={13} /> Complete — {travellers}{" "}
              {travellers === 1 ? "traveller" : "travellers"}. Ready to quote.
            </p>
          ) : (
            <p className="text-paper-text-muted">
              Still missing: <span className="text-paper-text">{gaps.join(", ")}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error ? <span className="text-[12.5px] text-red-600">{error}</span> : null}
          {saved && !error ? (
            <span className="text-[12.5px] text-paper-text-muted">Saved</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-ink-text disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save brief"}
          </button>
        </div>
      </div>
    </section>
  );
}
