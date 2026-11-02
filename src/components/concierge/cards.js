"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitEnquiry } from "@/app/actions/enquiry";
import {
  CalendarIcon,
  UsersIcon,
  ChevronIcon,
  SparkleIcon,
  CheckIcon,
} from "@/components/icons";

/**
 * Generative UI: the concierge's tools return these, and they render as real
 * components inside the conversation. A trip card here is the same trip that
 * exists on the site — not a description of one the model imagined.
 */

function TripCard({ trip, onClose }) {
  const scarce = trip.seatsLeft <= 5;

  return (
    <Link
      href={`/group-tours/${trip.slug}`}
      onClick={onClose}
      className="group block rounded-xl border border-paper-line bg-card p-3.5 transition-all hover:border-accent/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow text-paper-text-faint">
            {trip.destination}
          </span>
          <h4 className="mt-0.5 text-[14px] font-bold leading-snug text-paper-text">
            {trip.title}
          </h4>
        </div>
        <span className="shrink-0 rounded-md bg-accent/12 px-2 py-1 text-[10.5px] font-black text-accent-deep">
          {trip.duration}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-paper-text-muted">
        <span className="flex items-center gap-1">
          <CalendarIcon size={11} /> {trip.nextDeparture}
        </span>
        <span className={`flex items-center gap-1 font-semibold ${scarce ? "text-warn" : ""}`}>
          <UsersIcon size={11} /> {trip.seatsLeft} seats
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-paper-line pt-2.5">
        <span className="text-[14px] font-black text-paper-text">
          ₹{trip.pricePerPerson.toLocaleString("en-IN")}
          <span className="text-[11px] font-medium text-paper-text-faint"> /person</span>
        </span>
        <span className="flex items-center gap-0.5 text-[11.5px] font-bold text-accent-deep transition-transform group-hover:translate-x-0.5">
          View <ChevronIcon size={11} />
        </span>
      </div>
    </Link>
  );
}

function ComparisonCard({ trips, onClose }) {
  return (
    <div className="overflow-hidden rounded-xl border border-paper-line bg-card">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-paper-line bg-paper-dim">
            <th className="px-3 py-2 eyebrow text-paper-text-faint">
              Trip
            </th>
            <th className="px-2 py-2 eyebrow text-paper-text-faint">
              Days
            </th>
            <th className="px-3 py-2 text-right eyebrow text-paper-text-faint">
              From
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-line">
          {trips.map((trip) => (
            <tr key={trip.slug}>
              <td className="px-3 py-2.5">
                <Link
                  href={`/group-tours/${trip.slug}`}
                  onClick={onClose}
                  className="text-[12.5px] font-bold text-paper-text hover:text-accent-deep"
                >
                  {trip.title}
                </Link>
                <span className="mt-0.5 block text-[10.5px] text-paper-text-faint">
                  {trip.nextDeparture}
                </span>
              </td>
              <td className="px-2 py-2.5 text-[12px] text-paper-text-muted">{trip.duration}</td>
              <td className="px-3 py-2.5 text-right text-[12.5px] font-black text-paper-text">
                ₹{trip.pricePerPerson.toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlannerCard({ card, onClose }) {
  return (
    <Link
      href={card.href}
      onClick={onClose}
      className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/8 p-3.5 transition-colors hover:bg-accent/12"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
        <SparkleIcon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-paper-text">
          Build a {card.durationDays}-day {card.destination} itinerary
        </p>
        <p className="mt-0.5 text-[11.5px] text-paper-text-muted">
          Opens the AI planner with your brief filled in
        </p>
      </div>
      <ChevronIcon size={14} className="shrink-0 text-accent-deep" />
    </Link>
  );
}

const DEPARTURE_STATUS = {
  available: { label: "Open", className: "bg-good/12 text-good" },
  filling: { label: "Filling", className: "bg-warn/15 text-warn" },
  soldout: { label: "Full", className: "bg-paper-line-strong text-paper-text-faint" },
};

/** Every batch for a trip, so a date decision happens inside the chat. */
function DeparturesCard({ card, onClose }) {
  return (
    <div className="overflow-hidden rounded-xl border border-paper-line bg-card">
      <div className="border-b border-paper-line bg-paper-dim px-3.5 py-2.5">
        <p className="text-[12.5px] font-bold text-paper-text">{card.title}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint">
          ₹{card.advance.toLocaleString("en-IN")} holds a seat
        </p>
      </div>
      <div className="divide-y divide-paper-line">
        {card.departures.map((d) => {
          const status = DEPARTURE_STATUS[d.status] ?? DEPARTURE_STATUS.available;
          const full = d.status === "soldout";
          return (
            <Link
              key={d.id}
              href={full ? `/group-tours/${card.slug}` : `/group-tours/${card.slug}#book`}
              onClick={onClose}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                full ? "opacity-55" : "hover:bg-paper-dim"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-paper-text">{d.dates}</span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                  {!full && (
                    <span className="text-[11px] text-paper-text-faint">{d.seatsLeft} seats</span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] font-bold text-paper-text">
                ₹{d.pricePerPerson.toLocaleString("en-IN")}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** The close — one tap to the booking panel, pre-set to the chosen batch. */
function BookingCard({ card, onClose }) {
  return (
    <Link
      href={card.href}
      onClick={onClose}
      className="block rounded-xl border border-accent/40 bg-accent/8 p-3.5 transition-colors hover:bg-accent/12"
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent-deep">
        Ready to book
      </span>
      <p className="mt-1 text-[13.5px] font-bold text-paper-text">{card.title}</p>
      <p className="mt-0.5 text-[12px] text-paper-text-muted">
        {card.dates} · {card.travellers} {card.travellers === 1 ? "traveller" : "travellers"}
      </p>
      <div className="mt-2.5 flex items-center justify-between border-t border-accent/25 pt-2.5">
        <span className="text-[12px] text-paper-text-muted">
          ₹{card.advance.toLocaleString("en-IN")} to hold
          {card.seatsLeft <= 3 && (
            <span className="ml-1.5 font-semibold text-warn">
              only {card.seatsLeft} left
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-[12.5px] font-bold text-accent-deep">
          Reserve <ChevronIcon size={12} />
        </span>
      </div>
    </Link>
  );
}

/** A customised destination — no dates, no seats, an itinerary to request. */
function DestinationCard({ card, onClose }) {
  return (
    <Link
      href={`/customized-tours/${card.slug}`}
      onClick={onClose}
      className="group block rounded-xl border border-paper-line bg-card p-3.5 transition-all hover:border-accent/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow text-paper-text-faint">{card.destination}</span>
          <h4 className="mt-0.5 text-[14px] font-bold leading-snug text-paper-text">
            {card.title}
          </h4>
        </div>
        <span className="shrink-0 rounded-md bg-paper-dim px-2 py-1 text-[10.5px] font-bold text-paper-text-muted">
          {card.duration}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {card.goodFor.map((tag) => (
          <span key={tag} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-semibold text-accent-deep">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-paper-line pt-2.5">
        <span className="text-[13px] font-bold text-paper-text">
          <span className="text-[10.5px] font-medium text-paper-text-faint">from </span>
          ₹{card.fromPrice.toLocaleString("en-IN")}
        </span>
        <span className="flex items-center gap-0.5 text-[11.5px] font-bold text-accent-deep transition-transform group-hover:translate-x-0.5">
          Customise <ChevronIcon size={11} />
        </span>
      </div>
    </Link>
  );
}

/** The conversion card — a real enquiry, with the concierge's summary attached. */
function HandoffCard({ card }) {
  const [state, formAction, pending] = useActionState(submitEnquiry, { status: "idle" });

  if (state.status === "success") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent/10 p-3.5">
        <span className="mt-0.5 shrink-0 text-accent-deep">
          <CheckIcon size={15} />
        </span>
        <p className="text-[12.5px] leading-relaxed text-paper-text">
          <strong className="font-bold">Sent.</strong> A travel expert will call you shortly — they
          have the whole conversation, so you won&apos;t have to repeat any of it.
        </p>
      </div>
    );
  }

  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="rounded-xl border border-paper-line bg-card p-3.5">
      <p className="text-[12.5px] font-bold text-paper-text">Talk to a travel expert</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-text-muted">
        Name and number, and someone calls you back with real availability.
      </p>

      <input type="hidden" name="source" value="concierge" />
      <input type="hidden" name="message" value={card.reason} />
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.message && (
        <p role="alert" className="mt-2 text-[11.5px] font-semibold text-danger">
          {state.message}
        </p>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <input
          name="name"
          required
          type="text"
          placeholder="Your name"
          autoComplete="name"
          className="rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
        />
        <input
          name="phone"
          required
          type="tel"
          placeholder="Phone"
          autoComplete="tel"
          className="rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
        />
      </div>
      {(errors.name || errors.phone) && (
        <p role="alert" className="mt-1.5 text-[11.5px] font-semibold text-danger">
          {errors.name ?? errors.phone}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2.5 w-full rounded-lg bg-accent py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request a call back"}
      </button>
    </form>
  );
}

export default function ConciergeCards({ cards, onClose }) {
  if (!cards?.length) return null;

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {cards.map((card, i) => {
        if (card.type === "trip") return <TripCard key={i} trip={card} onClose={onClose} />;
        if (card.type === "comparison")
          return <ComparisonCard key={i} trips={card.trips} onClose={onClose} />;
        if (card.type === "destination")
          return <DestinationCard key={i} card={card} onClose={onClose} />;
        if (card.type === "departures")
          return <DeparturesCard key={i} card={card} onClose={onClose} />;
        if (card.type === "booking") return <BookingCard key={i} card={card} onClose={onClose} />;
        if (card.type === "planner") return <PlannerCard key={i} card={card} onClose={onClose} />;
        if (card.type === "handoff") return <HandoffCard key={i} card={card} />;
        return null;
      })}
    </div>
  );
}
