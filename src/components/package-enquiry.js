"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitEnquiry } from "@/app/actions/enquiry";
import { encodeTrip } from "@/lib/trip-link";
import { quickEnquiryHref, whatsappLink } from "@/lib/site";
import { CheckIcon, SparkleIcon, WhatsAppIcon, ChatIcon } from "@/components/icons";

/**
 * The customised-package call to action.
 *
 * NOT a booking panel. There are no batches, no seats and no advance here,
 * because a customised trip has none of those until it has been designed. The
 * only thing being asked for is a conversation — which is also the honest
 * version of the product.
 *
 * Three routes out, in order of how much commitment they need:
 *   1. Ask for a free itinerary  (the form below — highest intent)
 *   2. Draft it yourself with AI (deep-links the planner, pre-filled)
 *   3. WhatsApp                  (lowest friction, no form at all)
 */
export default function PackageEnquiry({ pkg }) {
  const [state, formAction, pending] = useActionState(submitEnquiry, { status: "idle" });

  // Pre-fill the AI planner from this package, so "draft it myself" starts
  // somewhere real rather than on an empty form.
  const days = Number.parseInt(pkg.duration, 10) || 6;
  const plannerHref = (() => {
    const encoded = encodeTrip({
      destination: pkg.destination.split("·")[0].trim(),
      durationDays: Math.min(Math.max(days, 1), 21),
      month: "",
      travellers: 2,
      travelWith: pkg.idealFor.includes("Honeymoon") ? "couple" : "friends",
      budget: pkg.fromPrice > 70000 ? "premium" : "comfortable",
      pace: "balanced",
      interests: [],
      notes: `Starting from the ${pkg.title} outline.`,
    });
    return encoded ? `/plan?trip=${encoded}` : "/plan";
  })();

  const waHref = quickEnquiryHref(
    `Hi YaadiGo — I'm interested in the ${pkg.title} trip (${pkg.destination}).`
  );
  const isWhatsApp = Boolean(whatsappLink(""));

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/8 p-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
          <CheckIcon size={18} />
        </span>
        <h3 className="mt-3.5 font-display text-[19px] font-bold text-paper-text">
          Got it — a draft is on its way.
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-paper-text-muted">
          A travel expert will call within a few hours with a first itinerary for {pkg.destination},
          built around what you told us. It&apos;s free, and nothing is payable until you approve it.
        </p>
      </div>
    );
  }

  const errors = state.errors ?? {};

  return (
    <div className="flex flex-col gap-3">
      <form
        action={formAction}
        className="rounded-2xl border border-paper-line bg-card p-6 shadow-xl shadow-ink/5"
      >
        <span className="eyebrow text-accent-deep">Free, no obligation</span>
        <h3 className="mt-2 font-display text-[21px] font-bold leading-snug text-paper-text">
          Get this planned around your dates
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-paper-text-muted">
          Tell us roughly when and who&apos;s coming. You get a full draft itinerary back — usually
          within a few hours — and you change it as many times as you like before anything is booked.
        </p>

        <input type="hidden" name="source" value="customised-package" />
        <input type="hidden" name="destination" value={pkg.destination} />
        <input
          type="hidden"
          name="message"
          value={[
            `CUSTOMISED TRIP ENQUIRY — ${pkg.title}`,
            `Destination: ${pkg.destination}`,
            `Suggested length: ${pkg.duration}`,
            `Indicative from-price: ₹${pkg.fromPrice.toLocaleString("en-IN")} per person`,
            `Good for: ${pkg.idealFor.join(", ")}`,
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
            className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-[12.5px] font-semibold text-paper-text"
          >
            {state.message}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <input
            name="name"
            required
            type="text"
            placeholder="Your name"
            autoComplete="name"
            className="w-full rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent"
          />
          <input
            name="phone"
            required
            type="tel"
            placeholder="Phone"
            autoComplete="tel"
            className="w-full rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent"
          />
          <input
            name="dates"
            type="text"
            placeholder="Roughly when? e.g. second week of Dec"
            className="w-full rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent"
          />
          <input
            name="groupSize"
            type="number"
            min="1"
            max="40"
            defaultValue={2}
            aria-label="How many travellers"
            className="w-full rounded-xl border border-paper-line-strong bg-paper px-3.5 py-3 text-[14px] outline-none focus:border-accent"
          />
        </div>

        {(errors.name || errors.phone) && (
          <p role="alert" className="mt-2 text-[12px] font-semibold text-danger">
            {errors.name ?? errors.phone}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Sending…" : "Get a free itinerary"}
        </button>
        <p className="mt-2.5 text-center text-[11.5px] leading-relaxed text-paper-text-faint">
          No payment until you approve the plan. We don&apos;t add you to a mailing list.
        </p>
      </form>

      <Link
        href={plannerHref}
        className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/8 p-4 transition-colors hover:bg-accent/12"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
          <SparkleIcon size={17} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-bold text-paper-text">
            Or draft it yourself, now
          </span>
          <span className="mt-0.5 block text-[12px] text-paper-text-muted">
            Opens the AI planner, pre-filled for {pkg.destination.split("·")[0].trim()}
          </span>
        </span>
      </Link>

      <a
        href={waHref}
        {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="flex items-center justify-center gap-2 rounded-2xl border border-paper-line-strong px-5 py-3.5 text-[14px] font-bold text-paper-text transition-colors hover:border-accent"
      >
        {isWhatsApp ? <WhatsAppIcon size={17} /> : <ChatIcon size={17} />}
        {isWhatsApp ? "Ask on WhatsApp" : "Send a quick question"}
      </a>
    </div>
  );
}
