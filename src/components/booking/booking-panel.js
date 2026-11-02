"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { submitEnquiry } from "@/app/actions/enquiry";
import WaitlistForm from "@/components/booking/waitlist-form";
import {
  formatDepartureRange,
  quoteBooking,
} from "@/lib/tours";
import { CheckIcon, UsersIcon, ChevronIcon, CalendarIcon } from "@/components/icons";

/**
 * Fixed-departure booking flow.
 *
 * Pick a batch, pick how you're sharing a room, pick where you join from, say
 * how many of you there are — and the price updates live, because the single
 * biggest reason people abandon a group-trip page is not knowing what they
 * will actually pay until the very end.
 *
 * IMPORTANT: this reserves a seat, it does not take money. There is no payment
 * gateway in this project, so the flow is honest about it — the desk confirms
 * the batch still has room and sends a payment link. Pretending to charge a
 * card here would be a lie the business then has to honour.
 */

const STATUS = {
  available: { label: "Seats open", className: "bg-good/12 text-good" },
  filling: { label: "Filling fast", className: "bg-warn/15 text-warn" },
  soldout: { label: "Sold out", className: "bg-paper-line-strong text-paper-text-faint" },
  closed: { label: "Bookings closed", className: "bg-paper-line-strong text-paper-text-faint" },
};

function Money({ value }) {
  return <>₹{value.toLocaleString("en-IN")}</>;
}

export default function BookingPanel({ tour }) {
  // Past and cancelled batches are history, not choices.
  const shown = (tour.departures ?? []).filter(
    (d) => d.status !== "completed" && d.status !== "cancelled"
  );

  // A trip with no dates yet (a new trip, or between seasons) must still be
  // a page someone can act on — not a crash on an empty list.
  if (shown.length === 0) {
    return (
      <div id="book" className="rounded-2xl border border-paper-line bg-card p-5 shadow-xl shadow-ink/5 sm:p-6">
        <span className="eyebrow text-paper-text-faint">Departures</span>
        <p className="mt-1 font-display text-[20px] font-bold text-paper-text">Dates coming soon</p>
        <div className="mt-4">
          <WaitlistForm
            tour={tour}
            heading="Be first to hear"
            body="Leave your number and we will tell you the moment dates are set — before they are announced."
          />
        </div>
      </div>
    );
  }

  return <BookingPanelWithDates tour={tour} shown={shown} />;
}

function BookingPanelWithDates({ tour, shown }) {
  // Default to the CHEAPEST bookable batch, not the earliest.
  //
  // Listings advertise `tour.price`, which is the lowest price across all
  // departures. Defaulting to the earliest batch meant someone could click
  // "from ₹27,000" and land on a page showing ₹28,500 — which reads as a
  // bait-and-switch even though both numbers are honest. The opening price
  // now always matches the one they clicked.
  const bookable = shown.filter((d) => d.bookable ?? d.status !== "soldout");
  const cheapest =
    bookable.length > 0
      ? bookable.reduce((low, d) => (d.price < low.price ? d : low))
      : shown[0];

  const [departureId, setDepartureId] = useState(cheapest.id);
  const [sharingId, setSharingId] = useState(tour.sharing[0].id);
  const [pickupId, setPickupId] = useState(tour.pickups[0].id);
  const [travellers, setTravellers] = useState(2);
  const [showForm, setShowForm] = useState(false);

  const departure = shown.find((d) => d.id === departureId) ?? cheapest;
  const soldOut = !(departure.bookable ?? departure.status !== "soldout");

  const quote = useMemo(
    () => quoteBooking({ tour, departure, sharingId, pickupId, travellers }),
    [tour, departure, sharingId, pickupId, travellers]
  );

  // Seats can't be requested beyond what the batch has left.
  const maxTravellers = Math.max(1, Math.min(departure.seatsLeft || 1, 10));

  const [state, formAction, pending] = useActionState(submitEnquiry, { status: "idle" });

  /**
   * Both Reserve buttons go through here — the inline one and the sticky bar
   * one. They previously diverged (the sticky bar was a bare #book anchor
   * that only scrolled), which is exactly the quiet drift duplicated CTAs
   * invite. One function, one behaviour: reveal the form and bring it into
   * view.
   */
  function startReserving() {
    setShowForm(true);
    // Defer so the form exists before we scroll to it.
    requestAnimationFrame(() => {
      document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (state.status === "success") {
    return (
      <div
        id="book"
        className="rounded-2xl border border-accent/40 bg-accent/8 p-6 sm:p-7"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
          <CheckIcon size={18} />
        </span>
        <h3 className="mt-3.5 font-display text-[20px] font-bold text-paper-text">
          Seats requested — we&apos;re on it.
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-paper-text-muted">
          A travel expert confirms the batch still has room and sends you a payment link for the{" "}
          <Money value={quote.advance} /> advance. Nothing is charged until you use it.
        </p>
        <dl className="mt-4 flex flex-col gap-1.5 border-t border-accent/25 pt-4 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-paper-text-muted">Departure</dt>
            <dd className="font-semibold text-paper-text">{formatDepartureRange(departure)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-paper-text-muted">Travellers</dt>
            <dd className="font-semibold text-paper-text">{travellers}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-paper-text-muted">Total</dt>
            <dd className="font-semibold text-paper-text">
              <Money value={quote.total} />
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const errors = state.errors ?? {};

  return (
    <>
      <div
        id="book"
        className="overflow-hidden rounded-2xl border border-paper-line bg-card shadow-xl shadow-ink/5"
      >
        {/* Price header */}
        <div className="border-b border-paper-line bg-paper-dim px-5 py-4 sm:px-6">
          <span className="eyebrow text-paper-text-faint">From</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-[30px] font-bold leading-none text-paper-text">
              <Money value={quote.perPerson} />
            </span>
            <span className="text-[13px] font-medium text-paper-text-muted">per person</span>
          </div>
          <p className="mt-1.5 text-[12px] text-paper-text-faint">
            {quote.sharing.label} · joining from {quote.pickup.city}
          </p>
        </div>

        <div className="flex flex-col gap-6 p-5 sm:p-6">
          {/* 1 — Batch */}
          <fieldset>
            <legend className="eyebrow flex items-center gap-1.5 text-paper-text-faint">
              <CalendarIcon size={12} /> Choose your departure
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              {shown.map((d) => {
                const status = STATUS[d.status] ?? STATUS.available;
                // A sold-out batch stays selectable, so its waitlist can be
                // joined; a closed one cannot be acted on at all.
                const disabled = d.status === "closed";
                const selected = d.id === departureId;
                return (
                  <label
                    key={d.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all ${
                      disabled
                        ? "cursor-not-allowed border-paper-line opacity-55"
                        : selected
                          ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                          : "border-paper-line-strong hover:border-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="departure"
                      value={d.id}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => {
                        setDepartureId(d.id);
                        setTravellers((n) => Math.min(n, Math.max(1, Math.min(d.seatsLeft, 10))));
                      }}
                      className="sr-only"
                    />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-bold text-paper-text">
                        {formatDepartureRange(d)}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-paper-text-muted">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                        {d.bookable && <>{d.seatsLeft} left</>}
                        {d.guaranteed && (
                          <span className="rounded bg-good/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-good">
                            Guaranteed
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-bold text-paper-text">
                      <Money value={d.price} />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 2 — Sharing */}
          <fieldset>
            <legend className="eyebrow text-paper-text-faint">Room sharing</legend>
            <div className="mt-3 flex flex-col gap-2">
              {tour.sharing.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-all ${
                    option.id === sharingId
                      ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                      : "border-paper-line-strong hover:border-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="sharing"
                    value={option.id}
                    checked={option.id === sharingId}
                    onChange={() => setSharingId(option.id)}
                    className="sr-only"
                  />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-paper-text">
                      {option.label}
                    </span>
                    <span className="text-[11.5px] text-paper-text-faint">{option.detail}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-paper-text-muted">
                    {option.delta === 0 ? "included" : `+₹${option.delta.toLocaleString("en-IN")}`}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 3 — Pickup */}
          {tour.pickups.length > 1 && (
            <fieldset>
              <legend className="eyebrow text-paper-text-faint">Joining from</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {tour.pickups.map((pickup) => (
                  <label key={pickup.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="pickup"
                      value={pickup.id}
                      checked={pickup.id === pickupId}
                      onChange={() => setPickupId(pickup.id)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-xl border border-paper-line-strong px-3.5 py-2 text-[13px] font-semibold text-paper-text-muted transition-all peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white">
                      {pickup.city}
                      {pickup.delta !== 0 && (
                        <span className="ml-1.5 font-mono text-[10.5px] opacity-80">
                          {pickup.delta > 0 ? "+" : "−"}₹
                          {Math.abs(pickup.delta).toLocaleString("en-IN")}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-paper-text-faint">{quote.pickup.detail}</p>
            </fieldset>
          )}

          {/* 4 — Travellers */}
          <fieldset>
            <legend className="eyebrow flex items-center gap-1.5 text-paper-text-faint">
              <UsersIcon size={12} /> Travellers
            </legend>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-1 rounded-xl border border-paper-line-strong p-1">
                <button
                  type="button"
                  onClick={() => setTravellers((n) => Math.max(1, n - 1))}
                  disabled={travellers <= 1}
                  aria-label="Fewer travellers"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] font-bold text-paper-text-muted transition-colors hover:bg-paper-dim disabled:opacity-35"
                >
                  −
                </button>
                <span className="w-8 text-center font-display text-[17px] font-bold tabular-nums text-paper-text">
                  {travellers}
                </span>
                <button
                  type="button"
                  onClick={() => setTravellers((n) => Math.min(maxTravellers, n + 1))}
                  disabled={travellers >= maxTravellers}
                  aria-label="More travellers"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] font-bold text-paper-text-muted transition-colors hover:bg-paper-dim disabled:opacity-35"
                >
                  +
                </button>
              </div>
              {travellers >= maxTravellers && !soldOut && (
                <span className="text-[11.5px] text-warn">
                  Only {departure.seatsLeft} seats left on this batch
                </span>
              )}
            </div>
          </fieldset>

          {/* Price breakdown — shown before the CTA, never after. */}
          <dl className="flex flex-col gap-2 rounded-xl bg-paper-dim p-4 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-paper-text-muted">
                <Money value={quote.perPerson} /> × {travellers}
              </dt>
              <dd className="font-semibold text-paper-text">
                <Money value={quote.total} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-paper-line pt-2">
              <dt className="font-semibold text-paper-text">Pay now to reserve</dt>
              <dd className="font-display text-[17px] font-bold text-accent-deep">
                <Money value={quote.advance} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-paper-text-faint">Balance before departure</dt>
              <dd className="text-paper-text-muted">
                <Money value={quote.balance} />
              </dd>
            </div>
          </dl>

          {soldOut ? (
            <WaitlistForm
              tour={tour}
              departure={departure}
              travellers={travellers}
              heading="This batch is full"
              body="Pick another date above — or join the waitlist. If a seat opens, we call you before it goes back on sale."
            />
          ) : !showForm ? (
            <button
              type="button"
              onClick={startReserving}
              className="w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-white transition-transform active:scale-[0.99]"
            >
              Reserve {travellers === 1 ? "my seat" : `${travellers} seats`}
            </button>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              {/* Everything the traveller chose travels with the lead, so the
                  desk quotes exactly what they saw. */}
              <input type="hidden" name="source" value="fixed-departure-booking" />
              <input type="hidden" name="destination" value={tour.title} />
              {/* The selection, not the prices. The server recomputes every
                  rupee from the live catalogue — posting the totals would let
                  a tampered form reserve a seat at whatever it liked, and
                  would lock in a price the desk may have changed since. */}
              <input type="hidden" name="bookingTripSlug" value={tour.slug} />
              <input type="hidden" name="bookingDepartureId" value={departure.id} />
              <input type="hidden" name="bookingSharingId" value={sharingId} />
              <input type="hidden" name="bookingPickupId" value={pickupId} />
              <input type="hidden" name="dates" value={formatDepartureRange(departure)} />
              <input type="hidden" name="groupSize" value={travellers} />
              <input
                type="hidden"
                name="message"
                value={[
                  `BOOKING REQUEST — ${tour.title}`,
                  `Departure: ${formatDepartureRange(departure)} (${departure.id})`,
                  `Sharing: ${quote.sharing.label}`,
                  `Joining from: ${quote.pickup.city}`,
                  `Travellers: ${travellers}`,
                  `Per person: ₹${quote.perPerson.toLocaleString("en-IN")}`,
                  `Total: ₹${quote.total.toLocaleString("en-IN")}`,
                  `Advance due: ₹${quote.advance.toLocaleString("en-IN")}`,
                  `Seats left on batch at request time: ${departure.seatsLeft}`,
                ].join("\n")}
              />
              <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label>
                  Company website
                  <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>

              {state.message && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[12.5px] font-semibold text-paper-text"
                >
                  {state.message}
                </p>
              )}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  name="name"
                  required
                  type="text"
                  placeholder="Your name"
                  autoComplete="name"
                  className="rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent"
                />
                <input
                  name="phone"
                  required
                  type="tel"
                  placeholder="Phone"
                  autoComplete="tel"
                  className="rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent"
                />
              </div>
              <input
                name="email"
                type="email"
                placeholder="Email (optional)"
                autoComplete="email"
                className="rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent"
              />
              {(errors.name || errors.phone || errors.email) && (
                <p role="alert" className="text-[12px] font-semibold text-danger">
                  {errors.name ?? errors.phone ?? errors.email}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
              >
                {pending ? "Reserving…" : `Confirm — hold ${travellers === 1 ? "1 seat" : `${travellers} seats`}`}
              </button>
              <p className="text-center text-[11.5px] leading-relaxed text-paper-text-faint">
                No card needed now. We confirm the batch has room and send a payment link for the{" "}
                <Money value={quote.advance} /> advance.
              </p>
            </form>
          )}

          <ul className="flex flex-col gap-1.5 border-t border-paper-line pt-4">
            {[
              `${tour.groupSize} per departure`,
              "Free rescheduling once, up to 21 days before departure",
              "Full inclusions listed below — no surprises at the desk",
            ].map((item) => (
              <li
                key={item}
                className="flex gap-2 text-[12.5px] leading-relaxed text-paper-text-muted"
              >
                <span className="mt-0.5 shrink-0 text-accent-deep">
                  <CheckIcon size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky mobile bar — the price and the CTA follow you down the page,
          which is the single highest-impact thing on a long trip page. */}
      <div
        className="no-print fixed inset-x-0 z-30 border-t border-paper-line bg-paper/95 px-4 py-3 backdrop-blur-xl md:hidden"
        style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block font-display text-[19px] font-bold leading-none text-paper-text">
              <Money value={quote.perPerson} />
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-paper-text-faint">
              per person · {formatDepartureRange(departure)}
            </span>
          </div>
          <button
            type="button"
            onClick={
              soldOut
                ? () =>
                    document
                      .getElementById("book")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                : startReserving
            }
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-5 py-3 text-[14px] font-bold text-white"
          >
            {soldOut ? "Other dates" : "Reserve"} <ChevronIcon size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
