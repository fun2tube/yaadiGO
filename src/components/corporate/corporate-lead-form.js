"use client";

import { useActionState } from "react";
import { submitEnquiry } from "@/app/actions/enquiry";
import { CheckIcon } from "@/components/icons";

const FIELD =
  "w-full rounded-xl border border-ink-line-strong bg-ink-soft px-4 py-3.5 text-[15px] text-ink-text outline-none transition-colors placeholder:text-ink-text-faint focus:border-accent focus:ring-4 focus:ring-accent/10";
const LABEL = "eyebrow text-ink-text-faint";

const VOLUMES = [
  { value: 5, label: "Under 10 trips / month" },
  { value: 25, label: "10–50 trips / month" },
  { value: 100, label: "50–150 trips / month" },
  { value: 200, label: "150+ trips / month" },
];

/**
 * The corporate lead magnet. Asks only what actually qualifies an account —
 * company, a name, one contact channel, rough volume — because every extra
 * field on a B2B form costs conversions, and the desk can ask the rest on the
 * call it is booking.
 */
export default function CorporateLeadForm({ id = "corporate-enquiry" }) {
  const [state, formAction, pending] = useActionState(submitEnquiry, { status: "idle" });

  if (state.status === "success") {
    return (
      <div
        id={id}
        className="flex items-start gap-4 rounded-2xl border border-accent/40 bg-accent/10 p-7"
      >
        <span className="mt-0.5 shrink-0 text-accent">
          <CheckIcon size={20} />
        </span>
        <div>
          <h3 className="font-display text-[19px] font-bold text-ink-text">
            Received — we&apos;ll be in touch within 24 hours.
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-text-muted">
            A travel desk specialist will come back with wallet terms, a proposed SLA, and a short
            discovery call slot. No obligation, no minimum volume to qualify.
          </p>
        </div>
      </div>
    );
  }

  const errors = state.errors ?? {};

  return (
    <form
      id={id}
      action={formAction}
      className="rounded-2xl border border-ink-line bg-ink-soft/60 p-6 backdrop-blur sm:p-8"
    >
      <h3 className="font-display text-[22px] font-black leading-snug text-ink-text">
        Set up a corporate account
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-text-muted">
        Tell us roughly how your team travels. You get wallet terms, an SLA and a named executive
        back within 24 hours.
      </p>

      <input type="hidden" name="source" value="corporate-desk" />
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company website
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.message && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-[13.5px] font-semibold text-ink-text"
        >
          {state.message}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={LABEL}>Company</span>
          <input
            name="company"
            required
            type="text"
            autoComplete="organization"
            placeholder="Acme Technologies Pvt Ltd"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Your name</span>
          <input name="name" required type="text" autoComplete="name" className={FIELD} />
          {errors.name && (
            <span role="alert" className="text-[12px] font-semibold text-danger">
              {errors.name}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Role</span>
          <input
            name="role"
            type="text"
            placeholder="HR / Admin / Finance"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Work email</span>
          <input name="email" required type="email" autoComplete="email" className={FIELD} />
          {errors.email && (
            <span role="alert" className="text-[12px] font-semibold text-danger">
              {errors.email}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Phone</span>
          <input name="phone" required type="tel" autoComplete="tel" className={FIELD} />
          {errors.phone && (
            <span role="alert" className="text-[12px] font-semibold text-danger">
              {errors.phone}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={LABEL}>Rough travel volume</span>
          <select name="monthlyTrips" defaultValue={25} className={FIELD}>
            {VOLUMES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={LABEL}>What do you need most? (optional)</span>
          <textarea
            name="message"
            rows={3}
            maxLength={2000}
            placeholder="GST reconciliation is a mess. We also run two offsites a year."
            className={`${FIELD} resize-y`}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-accent px-6 py-4 text-[15px] font-bold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:py-3.5"
      >
        {pending ? "Sending…" : "Get wallet terms & an SLA"}
      </button>
      <p className="mt-2.5 text-center text-[12px] text-ink-text-faint">
        No credit application. No minimum monthly volume. No obligation.
      </p>
    </form>
  );
}
