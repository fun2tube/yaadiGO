"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/crm/schema";
import { AlertIcon } from "@/components/icons";

/**
 * "Hotel from the directory" in the quotation builder.
 *
 * Pick a hotel, the check-in date and nights; every room type and meal plan
 * on its rate card is priced night by night (a stay can cross seasons) and
 * added as one line: quantity = rooms, sell and cost = the whole stay for one
 * room. The salesperson stops quoting hotel prices from memory, and the
 * margin on the quotation is the margin we actually agreed.
 *
 * An option missing a night's rate is shown but cannot be added: a guessed
 * night is how a quotation ends up below cost.
 */

const field = "w-full rounded-lg border border-paper-line-strong bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-accent";
const PLAN = { EP: "room only", CP: "breakfast", MAP: "breakfast + dinner", AP: "all meals" };

const fmt = (iso) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Hotels whose destination or town appears in the quote's destination first. */
function rank(hotels, destination) {
  const text = String(destination ?? "").toLowerCase();
  const local = (h) => [h.destination, h.city].some((v) => v && text.includes(String(v).toLowerCase()));
  return [...hotels].sort((a, b) => Number(local(b)) - Number(local(a)));
}

export default function HotelLinePicker({ destination, defaultCheckIn, onAdd, onClose }) {
  // Starts empty: the quote's "destination" is often a trip name ("Kashmir
  // Valley Escape"), which matches no hotel as a search. Hotels in the trip's
  // destination are listed first instead.
  const [query, setQuery] = useState("");
  const [hotels, setHotels] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? "");
  const [nights, setNights] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [stay, setStay] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/hotels?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        setHotels(response.ok ? data.hotels : []);
        if (!response.ok) setError(data.message ?? "Could not load hotels.");
      } catch (e) {
        if (e.name !== "AbortError") setError("No connection.");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!hotel || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          `/api/admin/hotels?price=${encodeURIComponent(hotel.id)}&checkIn=${checkIn}&nights=${nights}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) {
          setError(data.message ?? "Could not price that stay.");
          return;
        }
        setError(null);
        setStay(data);
      } catch (e) {
        if (e.name !== "AbortError") setError("No connection.");
      }
    })();
    return () => controller.abort();
  }, [hotel, checkIn, nights]);

  // Only the answer for what is selected NOW: a slow reply for the previous
  // hotel or dates must never be added at the wrong price.
  const priced =
    stay && hotel && stay.hotel.id === hotel.id && stay.checkIn === checkIn && stay.nights === nights ? stay : null;

  function add(option) {
    const n = priced.nights;
    const seasons = option.seasons.length ? ` (${option.seasons.join(" → ")})` : "";
    onAdd({
      kind: "hotel",
      label: `${priced.hotel.name}${priced.hotel.city ? `, ${priced.hotel.city}` : ""} — ${option.roomType}`,
      detail: `${n} night${n === 1 ? "" : "s"} from ${fmt(priced.checkIn)}, ${PLAN[option.mealPlan] ?? option.mealPlan}${seasons}. Price per room for the stay.`,
      quantity: Math.max(1, Number(rooms) || 1),
      unitPrice: option.sell,
      unitCost: option.cost,
      perPerson: false,
      confidence: "known",
    });
  }

  return (
    <div className="rounded-xl border border-accent/50 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-paper-text">Hotel from the directory</p>
        <button type="button" onClick={onClose} className="text-[12.5px] font-semibold text-paper-text-muted">
          Close
        </button>
      </div>

      {!hotel ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hotel, destination or town"
            aria-label="Search hotels"
            className={`${field} mt-2`}
          />
          {hotels === null ? (
            <p className="mt-2 text-[12px] text-paper-text-faint">Loading…</p>
          ) : hotels.length === 0 ? (
            <p className="mt-2 text-[12px] text-paper-text-muted">
              No hotel matches. Add it under Admin → Hotels with its rates, then pick it here.
            </p>
          ) : (
            <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {rank(hotels, destination).map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => setHotel(h)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-paper-dim"
                  >
                    <span>
                      <strong className="text-paper-text">{h.name}</strong>{" "}
                      <span className="text-paper-text-faint">{[h.city, h.destination].filter(Boolean).join(", ")}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-paper-text-muted">
                      {h.currentRates ? `from ${money(h.fromSell)}` : "no rates"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] text-paper-text-muted">
            <strong className="text-paper-text">{hotel.name}</strong> {hotel.city ? `· ${hotel.city}` : ""}{" "}
            <button type="button" onClick={() => setHotel(null)} className="ml-1 font-semibold text-accent-deep">
              change
            </button>
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-paper-text-muted">
              Check-in
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-paper-text-muted">
              Nights
              <input type="number" min="1" max="60" value={nights} onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-paper-text-muted">
              Rooms
              <input type="number" min="1" max="50" value={rooms} onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))} className={field} />
            </label>
          </div>

          {!checkIn ? (
            <p className="mt-2 text-[12px] text-paper-text-muted">Pick the check-in date to see prices.</p>
          ) : priced && priced.options.length === 0 ? (
            <p className="mt-2 text-[12px] text-paper-text-muted">This hotel has no rates yet. Add them under Admin → Hotels.</p>
          ) : priced ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {priced.options.map((o) => (
                <li
                  key={`${o.roomType}-${o.mealPlan}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper-line px-2.5 py-2 text-[12.5px]"
                >
                  <span>
                    <strong className="text-paper-text">{o.roomType}</strong> · {PLAN[o.mealPlan] ?? o.mealPlan}
                    {o.complete ? (
                      <span className="block font-mono text-[11px] text-paper-text-faint">
                        {money(o.sell)} per room for {priced.nights} night{priced.nights === 1 ? "" : "s"} · costs us {money(o.cost)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11.5px] text-warn">
                        <AlertIcon size={11} /> No rate for {o.missingNights.map(fmt).join(", ")}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={!o.complete}
                    onClick={() => add(o)}
                    className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-ink-text disabled:opacity-40"
                  >
                    Add {Number(rooms) > 1 ? `${rooms} rooms` : ""}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}
