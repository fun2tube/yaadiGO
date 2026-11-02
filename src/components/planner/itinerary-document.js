"use client";

import { useSyncExternalStore } from "react";
import DayCard from "./day-card";
import { ItineraryHeader, ItineraryTail, AI_DISCLAIMER } from "./itinerary-parts";
import BrandLogo from "@/components/brand-logo";
import { CONTACT } from "@/lib/site";

const noopSubscribe = () => () => {};
const readInjected = () => window.__YAADIGO_PDF__ ?? null;
const readNothing = () => null;

/**
 * The itinerary as a document, for `/pdf/itinerary`.
 *
 * The plan arrives on `window.__YAADIGO_PDF__`, placed there by the server's
 * headless browser before this page's scripts run (lib/pdf/render.js) — it is
 * never stored and never in a URL. The same day cards and sections as the
 * planner, minus everything interactive.
 *
 * `data-pdf-ready` is the renderer's signal that the content is in the DOM.
 * Without an injected plan the page says so plainly, and is never "ready".
 */
export default function ItineraryDocument() {
  const itinerary = useSyncExternalStore(noopSubscribe, readInjected, readNothing);

  if (!itinerary) {
    return (
      <p className="p-10 text-[14px] text-paper-text-muted">
        This page renders a trip plan into a PDF. Open the AI planner to make one.
      </p>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article data-pdf-ready className="flex flex-col gap-5">
      <header className="flex items-center justify-between border-b border-paper-line pb-4">
        <BrandLogo height={44} forPrint />
        <span className="text-right text-[11.5px] leading-snug text-paper-text-faint">
          Trip plan · {today}
          {CONTACT.phone && <span className="block">{CONTACT.phone}</span>}
        </span>
      </header>

      <ItineraryHeader header={itinerary} />

      {itinerary.days.map((day) => (
        <DayCard key={day.day} day={day} canRegenerate={false} />
      ))}

      <ItineraryTail itinerary={itinerary} />

      <footer className="print-block rounded-2xl border border-paper-line bg-paper-dim p-5">
        <p className="text-[13.5px] font-semibold text-paper-text">
          Want this priced and booked? A YaadiGo planner will turn it into a firm quotation.
        </p>
        <p className="mt-1 text-[12.5px] text-paper-text-muted">
          {[CONTACT.phone, CONTACT.email, "yaadigo.com/plan"].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-3 text-[11.5px] leading-relaxed text-paper-text-faint">{AI_DISCLAIMER}</p>
      </footer>
    </article>
  );
}
