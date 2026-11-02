"use client";

import { useActionState } from "react";
import { submitEnquiry } from "@/app/actions/enquiry";
import { TRAVEL_WITH, BUDGET_BANDS, PACES } from "@/lib/planner";
import { CheckIcon } from "@/components/icons";

const FIELD =
  "w-full rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[15px] text-paper-text outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10";

function label(list, value) {
  return list.find((i) => i.value === value)?.label ?? value;
}

/**
 * The conversion step: turns a generated itinerary into a real lead, carrying
 * the whole plan with it so the travel desk quotes what the traveller actually
 * saw rather than starting the conversation from scratch.
 */
export default function SendToDesk({ input, itinerary }) {
  const [state, formAction, pending] = useActionState(submitEnquiry, { status: "idle" });

  if (state.status === "success") {
    return (
      <div
        id="send-to-desk"
        className="no-print flex items-start gap-4 rounded-2xl border border-accent/40 bg-accent/8 p-7"
      >
        <span className="mt-0.5 shrink-0 text-accent-deep">
          <CheckIcon size={20} />
        </span>
        <div>
          <h3 className="font-display text-[19px] font-bold text-paper-text">
            Sent — with the full itinerary attached.
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-paper-text-muted">
            A travel expert will come back with real availability and firm pricing for this exact
            plan, usually within a few hours. Nothing is payable until you approve it.
          </p>
        </div>
      </div>
    );
  }

  const errors = state.errors ?? {};

  return (
    <form
      id="send-to-desk"
      action={formAction}
      data-reveal
      className="no-print rounded-2xl border border-paper-line bg-card p-7 shadow-xl shadow-ink/5 sm:p-8"
    >
      <span className="eyebrow text-accent-deep">
        Turn this into a real trip
      </span>
      <h3 className="mt-2 font-display text-[21px] font-bold leading-snug text-paper-text">
        Get this itinerary priced and checked by a human
      </h3>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-paper-text-muted">
        We send the whole plan to the desk with your details. A travel expert checks availability
        on your dates, swaps anything that doesn&apos;t hold up, and comes back with firm pricing.
      </p>

      {/* The plan travels with the lead. */}
      <input type="hidden" name="source" value="ai-planner" />
      <input type="hidden" name="destination" value={itinerary.destination} />
      <input type="hidden" name="dates" value={input.month || "Not fixed yet"} />
      <input type="hidden" name="groupSize" value={input.travellers} />
      <input type="hidden" name="itinerary" value={JSON.stringify(itinerary)} />
      <input
        type="hidden"
        name="message"
        value={[
          `AI planner itinerary: ${itinerary.title}`,
          `${itinerary.durationDays} days in ${itinerary.destination}`,
          `${input.travellers} travelling (${label(TRAVEL_WITH, input.travelWith)})`,
          `Budget band: ${label(BUDGET_BANDS, input.budget)} · Pace: ${label(PACES, input.pace)}`,
          input.interests.length ? `Interests: ${input.interests.join(", ")}` : null,
          input.notes ? `Their notes: ${input.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n")}
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
          className="mt-5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13.5px] font-semibold text-paper-text"
        >
          {state.message}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow text-paper-text-faint">
            Name
          </span>
          <input name="name" required type="text" autoComplete="name" className={FIELD} />
          {errors.name && (
            <span role="alert" className="text-[12px] font-semibold text-danger">
              {errors.name}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow text-paper-text-faint">
            Phone
          </span>
          <input name="phone" required type="tel" autoComplete="tel" className={FIELD} />
          {errors.phone && (
            <span role="alert" className="text-[12px] font-semibold text-danger">
              {errors.phone}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow text-paper-text-faint">
            Email <span className="font-medium normal-case">(optional)</span>
          </span>
          <input name="email" type="email" autoComplete="email" className={FIELD} />
          {errors.email && (
            <span role="alert" className="text-[12px] font-semibold text-danger">
              {errors.email}
            </span>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-accent px-6 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:w-auto sm:px-9"
      >
        {pending ? "Sending…" : "Send this plan to the travel desk"}
      </button>
      <p className="mt-2.5 text-[12px] text-paper-text-faint">
        No payment until you approve the final itinerary.
      </p>
    </form>
  );
}
