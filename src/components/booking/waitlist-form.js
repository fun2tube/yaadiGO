"use client";

import { useActionState } from "react";
import { submitEnquiry } from "@/app/actions/enquiry";
import { CheckIcon } from "@/components/icons";

/**
 * "Tell me if a seat opens" — on a sold-out batch, or a trip with no dates yet.
 *
 * Goes through the same enquiry action as every other form, so the person is
 * a lead in the inbox straight away (with spam checks and the same
 * validation), and additionally a waitlist entry on the batch. When a seat
 * comes free the desk is notified and rings them, first come first offered.
 */
export default function WaitlistForm({ tour, departure = null, travellers = 2, heading, body }) {
  const [state, formAction, pending] = useActionState(submitEnquiry, { status: "idle" });
  const errors = state.errors ?? {};

  if (state.status === "success") {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/8 p-4">
        <p className="flex items-center gap-2 text-[14px] font-bold text-paper-text">
          <CheckIcon size={15} /> You&apos;re on the list.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-paper-text-muted">
          {departure
            ? "If a seat opens on this batch, we call you first — before it goes back on sale."
            : "We'll tell you as soon as dates are set for this trip."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2.5 rounded-xl border border-paper-line-strong p-4">
      <p className="text-[14px] font-bold text-paper-text">{heading}</p>
      <p className="text-[12.5px] leading-relaxed text-paper-text-muted">{body}</p>

      <input type="hidden" name="source" value="waitlist" />
      <input type="hidden" name="destination" value={tour.title} />
      <input type="hidden" name="bookingTripSlug" value={tour.slug} />
      {departure && <input type="hidden" name="bookingDepartureId" value={departure.id} />}
      <input type="hidden" name="waitlist" value="1" />
      <input type="hidden" name="groupSize" value={travellers} />
      <input
        type="hidden"
        name="message"
        value={
          departure
            ? `WAITLIST — ${tour.title}, ${departure.start} batch, ${travellers} traveller(s)`
            : `DATES WANTED — ${tour.title}. Tell me when departures are set.`
        }
      />
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.message && (
        <p role="alert" className="text-[12.5px] font-semibold text-danger">{state.message}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="name" required placeholder="Your name" autoComplete="name" className="rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent" />
        <input name="phone" required type="tel" placeholder="Phone" autoComplete="tel" className="rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent" />
      </div>
      {(errors.name || errors.phone) && (
        <p role="alert" className="text-[12px] font-semibold text-danger">{errors.name ?? errors.phone}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-ink px-5 py-3 text-[14px] font-bold text-ink-text disabled:opacity-60"
      >
        {pending ? "Adding you…" : departure ? "Join the waitlist" : "Tell me when dates are set"}
      </button>
    </form>
  );
}
