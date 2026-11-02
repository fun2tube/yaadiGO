"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { encodeTrip, parseAsk, PLAN_DEFAULTS } from "@/lib/trip-link";
import { SparkleIcon, ChevronIcon, AlertIcon } from "@/components/icons";

/**
 * One question.
 *
 * The competitors run 18 and 19 homepage sections. This runs one input, and
 * the restraint IS the differentiation — it costs nothing but discipline and
 * it is the first thing a visitor meets. Everything else still lives below;
 * nothing has been taken away from anyone who would rather browse.
 *
 * VOICE IS THE POINT. Many Indian travellers type English slowly and speak it
 * fluently, Chrome on Android is the dominant device here, and the Web Speech
 * API is free. No Indian travel site offers it. It is the highest-leverage,
 * lowest-cost thing on the whole UI/UX plan.
 *
 * Three rules it is built around:
 *
 *   THE TRANSCRIPT IS ALWAYS VISIBLE AND ALWAYS EDITABLE. Hinglish place-name
 *   recognition is imperfect — "Ladakh" comes back as "the duck" often enough
 *   to matter — so speech fills the text box rather than submitting. The
 *   person always sees what we heard and can fix it.
 *
 *   TYPING IS NEVER SECONDARY. Speech recognition is weak on iOS Safari and
 *   absent in some browsers entirely. The mic is an addition to the input, not
 *   a replacement for it, and it hides itself where it does not work rather
 *   than offering a button that does nothing.
 *
 *   NOTHING IS HIDDEN BEFORE HYDRATION. No `opacity: 0` on the server-rendered
 *   markup — the lesson from the destinations grid and from template.js, where
 *   an entrance animation made the whole site invisible without JS.
 */

/** Somewhere to start for people who will neither speak nor type. */
const SUGGESTIONS = ["Ladakh", "Kerala", "Kashmir", "Bali", "Vietnam"];

export default function AskBar() {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognition = useRef(null);
  const inputRef = useRef(null);
  const router = useRouter();

  /**
   * Does this browser do speech recognition?
   *
   * `useSyncExternalStore` rather than setting state in an effect: the server
   * snapshot is `false`, so the markup React renders on the server and the
   * markup it hydrates match exactly, and the mic appears on the first client
   * render rather than after a flash. Setting state in an effect would do the
   * same job with a re-render and a lint error.
   *
   * There is nothing to subscribe to — browser support does not change
   * mid-session — so the subscribe function is a no-op.
   */
  const supported = useSyncExternalStore(
    () => () => {},
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    () => false
  );

  useEffect(() => {
    const Recognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Recognition) return;

    const engine = new Recognition();
    // en-IN rather than en-US: it is trained on Indian English and handles
    // Indian place names and Hinglish code-switching far better.
    engine.lang = "en-IN";
    engine.interimResults = true;
    engine.continuous = false;
    engine.maxAlternatives = 1;

    engine.onresult = (event) => {
      // Interim results stream in so the box fills as they speak — silence
      // while someone talks reads as a dead microphone.
      const text = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("")
        .trim();
      setValue(text);
    };

    engine.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone blocked. Allow it in your browser, or just type.");
      } else if (event.error === "no-speech") {
        setError("Didn't catch that — try again, or type it.");
      } else if (event.error !== "aborted") {
        setError("Voice isn't working right now. Typing still does.");
      }
    };

    engine.onend = () => {
      setListening(false);
      // Focus the box so the next move is correcting the transcript, which is
      // usually what is needed.
      inputRef.current?.focus();
    };

    recognition.current = engine;

    return () => {
      try {
        engine.abort();
      } catch {
        /* Already stopped. Nothing to do. */
      }
    };
  }, []);

  function toggleVoice() {
    const engine = recognition.current;
    if (!engine) return;
    setError(null);

    if (listening) {
      engine.stop();
      return;
    }
    try {
      setValue("");
      engine.start();
      setListening(true);
    } catch {
      // start() throws if called while already running — harmless.
      setListening(false);
    }
  }

  function go(destination) {
    const where = (destination ?? value).trim();
    if (!where) {
      inputRef.current?.focus();
      return;
    }
    // Straight into the planner with the destination filled in. The visitor
    // asked one question; the next thing they should see is their itinerary
    // being written, not another form.
    // "Manali 4 days" → Manali, 4 days, rather than a 6-day plan for a
    // place called "Manali 4 days".
    const asked = parseAsk(where);
    const trip = encodeTrip({
      ...PLAN_DEFAULTS,
      destination: asked.destination || where,
      ...(asked.durationDays ? { durationDays: asked.durationDays } : {}),
    });
    router.push(trip ? `/plan?trip=${trip}` : "/plan");
  }

  return (
    <div className="w-full">
      {/* The hero's search box (2026-10-11: the AI planner is the product's
          front door, so it is the first thing on the page). White card on the
          photo, the largest tap targets on the page, one obvious button. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go();
        }}
      >
        <label htmlFor="ask-bar-input" className="sr-only">
          Where do you want to go?
        </label>
        <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.45)] ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-accent">
          <span aria-hidden="true" className="hidden pl-2 text-accent sm:block">
            <SparkleIcon size={20} />
          </span>
          <input
            id="ask-bar-input"
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Where do you want to go?"
            enterKeyHint="go"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-2 py-3 text-[17px] font-medium text-paper-text outline-none placeholder:font-normal placeholder:text-paper-text-faint sm:text-[18px]"
          />

          {supported && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={listening ? "Stop listening" : "Speak instead of typing"}
              aria-pressed={listening}
              // A real, tappable target in the thumb zone — 44px minimum.
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
                listening ? "bg-accent text-white" : "bg-paper-dim text-paper-text-muted hover:text-paper-text"
              }`}
            >
              <MicIcon active={listening} />
            </button>
          )}

          <button
            type="submit"
            className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-bold text-white transition-colors hover:bg-accent-deep sm:px-6"
          >
            <span className="sm:hidden">Plan</span>
            <span className="hidden sm:inline">Plan my trip</span>
            <ChevronIcon size={15} />
          </button>
        </div>

        {listening && (
          <p className="mt-2.5 flex items-center gap-2 text-[14px] font-semibold text-white">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Listening — say a place, in English or Hindi
          </p>
        )}

        {error && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[14px] text-white">
            <AlertIcon size={14} /> {error}
          </p>
        )}
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13.5px] font-medium text-white/85">Popular:</span>
        {SUGGESTIONS.map((place) => (
          <button
            key={place}
            type="button"
            onClick={() => go(place)}
            className="rounded-full bg-white/15 px-3.5 py-1.5 text-[13.5px] font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm transition-colors hover:bg-white hover:text-paper-text"
          >
            {place}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Drawn rather than imported — the icon set has no microphone. */
function MicIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="9"
        y="2"
        width="6"
        height="12"
        rx="3"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
