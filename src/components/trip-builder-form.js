"use client";

import { useActionState } from "react";
import { submitEnquiry } from "@/app/actions/enquiry";

const INTERESTS = ["Adventure", "Relaxation", "Culture & heritage", "Pilgrimage", "Wildlife"];
const BUDGET_BANDS = [
  "Under ₹25,000",
  "₹25,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "Above ₹1,00,000",
];

const FIELD =
  "rounded-lg border border-paper-line-strong bg-paper px-3.5 py-2.5 text-[14px] text-paper-text outline-none focus:border-accent";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium text-paper-text-muted";

function FieldError({ message }) {
  if (!message) return null;
  return (
    <span role="alert" className="text-[12px] font-medium text-accent-deep">
      {message}
    </span>
  );
}

export default function TripBuilderForm({
  source = "trip-builder",
  heading = "Tell us about the trip",
}) {
  const [state, formAction, pending] = useActionState(submitEnquiry, { status: "idle" });

  if (state.status === "success") {
    return (
      <div id="enquire" className="rounded-2xl border border-paper-line bg-card p-7 text-center">
        <h3 className="font-display text-[19px] font-medium text-paper-text">
          Got it — we&apos;re on it.
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-paper-text-muted">
          A travel expert will call within a few hours with a draft
          itinerary based on what you told us. No payment needed until you
          approve it.
        </p>
      </div>
    );
  }

  const errors = state.errors ?? {};
  const values = state.values ?? {};

  return (
    <form
      id="enquire"
      action={formAction}
      className="rounded-2xl border border-paper-line bg-card p-7"
    >
      <h3 className="font-display text-[19px] font-medium text-paper-text">{heading}</h3>

      <input type="hidden" name="source" value={source} />
      {/* Honeypot — hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.message && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-[13px] text-accent-deep"
        >
          {state.message}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Name
          <input
            name="name"
            required
            type="text"
            autoComplete="name"
            defaultValue={values.name ?? ""}
            aria-invalid={errors.name ? "true" : undefined}
            className={FIELD}
          />
          <FieldError message={errors.name} />
        </label>
        <label className={LABEL}>
          Phone
          <input
            name="phone"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={values.phone ?? ""}
            aria-invalid={errors.phone ? "true" : undefined}
            className={FIELD}
          />
          <FieldError message={errors.phone} />
        </label>
        <label className={LABEL}>
          Email <span className="font-normal text-paper-text-faint">(optional)</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values.email ?? ""}
            aria-invalid={errors.email ? "true" : undefined}
            className={FIELD}
          />
          <FieldError message={errors.email} />
        </label>
        <label className={LABEL}>
          Destination(s)
          <input
            name="destination"
            required
            type="text"
            placeholder="e.g. Vietnam, or undecided"
            defaultValue={values.destination ?? ""}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          Travel dates
          <input
            name="dates"
            type="text"
            placeholder="e.g. first week of Dec"
            defaultValue={values.dates ?? ""}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          Group size
          <input
            name="groupSize"
            type="number"
            min="1"
            max="999"
            defaultValue={values.groupSize ?? 2}
            className={FIELD}
          />
        </label>
        <label className={`${LABEL} sm:col-span-2`}>
          Budget band (per person)
          <select name="budget" defaultValue={values.budget ?? BUDGET_BANDS[1]} className={FIELD}>
            {BUDGET_BANDS.map((band) => (
              <option key={band}>{band}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-[13px] font-medium text-paper-text-muted">Interests</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <label key={interest} className="cursor-pointer">
              <input
                type="checkbox"
                name="interests"
                value={interest}
                defaultChecked={values.interests?.includes(interest)}
                className="peer sr-only"
              />
              <span className="block rounded-full border border-paper-line-strong px-3.5 py-1.5 text-[13px] font-medium text-paper-text-muted transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ink-text peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {interest}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className={`${LABEL} mt-4`}>
        Anything else? <span className="font-normal text-paper-text-faint">(optional)</span>
        <textarea
          name="message"
          rows={3}
          defaultValue={values.message ?? ""}
          placeholder="Anniversary trip, travelling with parents, must include a specific hotel…"
          className={`${FIELD} resize-y`}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-ink px-5 py-3 text-[14px] font-semibold text-ink-text transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {pending ? "Sending…" : "Start Planning — it's free"}
      </button>
      <p className="mt-2.5 text-center text-[12px] text-paper-text-faint">
        No payment until you approve the itinerary.
      </p>
    </form>
  );
}
