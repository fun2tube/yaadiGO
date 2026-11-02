"use client";

import { useCallback, useRef, useState } from "react";
import {
  LazyMotion,
  domMax,
  m,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import PlanForm from "./plan-form";
import DayCard, { DayCardSkeleton } from "./day-card";
import SendToDesk from "./send-to-desk";
import { ItineraryHeader, ItineraryTail, AI_DISCLAIMER } from "./itinerary-parts";
import PdfDownloadButton from "@/components/pdf-download-button";
import { AlertIcon, SparkleIcon, CheckIcon, ChevronIcon } from "@/components/icons";
import { PLAN_DEFAULTS, encodeTrip } from "@/lib/trip-link";

/** Reads an SSE body without pulling in a dependency for four lines of parsing. */
async function* readEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);

      const event = /^event: (.+)$/m.exec(raw)?.[1];
      const data = /^data: (.+)$/m.exec(raw)?.[1];
      if (event && data) {
        try {
          yield { event, data: JSON.parse(data) };
        } catch {
          // A malformed frame is skipped rather than killing the stream.
        }
      }
    }
  }
}

export default function Planner({ initialTrip }) {
  const [input, setInput] = useState(initialTrip ?? PLAN_DEFAULTS);
  // The CSS layer honours prefers-reduced-motion already; the JS layer must be
  // told. Duration 0 keeps the layout bookkeeping and removes only the travel.
  const reduced = useReducedMotion();

  const [status, setStatus] = useState("idle"); // idle | streaming | done | error
  const [header, setHeader] = useState(null);
  const [days, setDays] = useState([]);
  const [itinerary, setItinerary] = useState(null);
  const [error, setError] = useState(null);
  const [busyDay, setBusyDay] = useState(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  const generate = useCallback(async (values) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setInput(values);
    setStatus("streaming");
    setHeader(null);
    setDays([]);
    setItinerary(null);
    setError(null);

    const encoded = encodeTrip(values);
    if (encoded) {
      window.history.replaceState(null, "", `?trip=${encoded}`);
    }

    // Let the results area come into view as the first content lands.
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );

    try {
      const response = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        setError(body.message ?? "The planner isn't reachable right now.");
        setStatus("error");
        return;
      }

      for await (const { event, data } of readEvents(response)) {
        if (event === "header") setHeader(data);
        else if (event === "day") setDays((prev) => [...prev, data]);
        else if (event === "complete") {
          setItinerary(data);
          setDays(data.days);
          setStatus("done");
        } else if (event === "error") {
          setError(data.message);
          setStatus("error");
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError("The connection dropped before the plan finished. Please try again.");
      setStatus("error");
    }
  }, []);

  const regenerateDay = useCallback(
    async (dayNumber, instruction) => {
      if (!itinerary) return;
      setBusyDay(dayNumber);
      try {
        const response = await fetch("/api/plan/day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, itinerary, dayNumber, instruction }),
        });
        const body = await response.json();

        if (!response.ok) {
          setError(body.message ?? "Couldn't rewrite that day.");
          return;
        }

        const replace = (list) => list.map((d) => (d.day === dayNumber ? body.day : d));
        setDays(replace);
        setItinerary((prev) => ({ ...prev, days: replace(prev.days) }));
        setError(null);
      } catch {
        setError("Couldn't reach the planner to rewrite that day.");
      } finally {
        setBusyDay(null);
      }
    },
    [input, itinerary]
  );

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }

  const streaming = status === "streaming";
  const pendingDays = streaming && header ? Math.max(header.durationDays - days.length, 0) : 0;

  return (
    <div className="flex flex-col gap-10">
      <div className="no-print">
        <PlanForm initialValues={input} onSubmit={generate} disabled={streaming} />
      </div>

      <div ref={resultsRef} className="scroll-mt-24">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-5"
          >
            <span className="mt-0.5 shrink-0 text-danger">
              <AlertIcon size={18} />
            </span>
            <div>
              <p className="text-[14.5px] font-semibold text-paper-text">{error}</p>
              <p className="mt-1 text-[13.5px] text-paper-text-muted">
                You can still tell the travel desk what you had in mind — a human plans it either
                way.
              </p>
            </div>
          </div>
        )}

        {streaming && !header && (
          <div className="flex items-center gap-3 rounded-2xl border border-paper-line bg-card p-6">
            <span className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-accent/15 text-accent-deep">
              <SparkleIcon size={16} />
            </span>
            <p className="text-[14.5px] font-semibold text-paper-text">
              Reading the map, checking the season…
            </p>
          </div>
        )}

        {header && (
          <div className="flex flex-col gap-6">
            {/* Trip header */}
            <ItineraryHeader header={header} />

            {/* Actions */}
            <div className="no-print flex flex-wrap gap-2.5">
              {/* Rendered on the server from the same components as this
                  page — a real file, no print dialog. The itinerary lives
                  only in this browser, so it travels in the request body. */}
              <PdfDownloadButton
                href="/api/plan/pdf"
                body={itinerary}
                disabled={!itinerary}
                filename="YaadiGo-trip-plan.pdf"
                className="rounded-full border border-paper-line-strong bg-card px-5 py-2.5 text-[13.5px] font-bold text-paper-text transition-colors hover:border-accent"
              />
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1.5 rounded-full border border-paper-line-strong bg-card px-5 py-2.5 text-[13.5px] font-bold text-paper-text transition-colors hover:border-accent"
              >
                {copied ? (
                  <>
                    <CheckIcon size={14} /> Link copied
                  </>
                ) : (
                  "Copy shareable link"
                )}
              </button>
              <a
                href="#send-to-desk"
                className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white shadow-md shadow-accent/25"
              >
                Get this priced <ChevronIcon size={14} />
              </a>
            </div>

            {/* Days
              *
              * This is the moment the whole site is built around: the visitor
              * watching their trip get written. So it is the one place worth
              * animating most carefully.
              *
              * Without `layout`, each arriving day REPLACED a skeleton of a
              * different height and the whole column jolted — once per day, so
              * eight times on an eight-day trip. The jolt is what made it feel
              * like a page loading rather than a plan being written.
              *
              * `initial` is safe here, unlike the destinations grid: nothing in
              * this list is server-rendered. It exists only after the visitor
              * submits the form, so there is no SSR state to protect and no
              * JS-off case to degrade — the opposite of the rule in
              * docs/design/motion.md, for the opposite reason.
              */}
            <LazyMotion features={domMax} strict>
              <m.div layout className="flex flex-col gap-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {days.map((day) => (
                    <m.div
                      key={`day-${day.day}`}
                      layout
                      // Arrives from just below, the direction reading moves.
                      // 14px, not 40: this is a line of a document appearing,
                      // not a card flying in.
                      initial={reduced ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reduced ? 0 : 0.45,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <DayCard
                        day={day}
                        busy={busyDay === day.day}
                        canRegenerate={Boolean(itinerary) && busyDay === null}
                        onRegenerate={(instruction) => regenerateDay(day.day, instruction)}
                      />
                    </m.div>
                  ))}

                  {Array.from({ length: pendingDays }).map((_, i) => (
                    <m.div
                      // Keyed from the END of the queue, so the skeleton that
                      // disappears is always the last one. Keyed by index from
                      // the start, React would reuse the wrong node and the
                      // card that just arrived would animate out instead.
                      key={`skeleton-${pendingDays - i}`}
                      layout
                      initial={false}
                      exit={reduced ? {} : { opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.25, ease: "linear" }}
                    >
                      <DayCardSkeleton />
                    </m.div>
                  ))}
                </AnimatePresence>
              </m.div>
            </LazyMotion>

            {/* Tail sections — only exist once the document closes */}
            {itinerary && <ItineraryTail itinerary={itinerary} />}

            {itinerary && <SendToDesk input={input} itinerary={itinerary} />}

            <p className="no-print text-[12.5px] leading-relaxed text-paper-text-faint">
              {AI_DISCLAIMER}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
