"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { encodeTrip, PLAN_DEFAULTS } from "@/lib/trip-link";
import { SparkleIcon, ChevronIcon, AlertIcon } from "@/components/icons";
import SplitHeading from "@/components/motion/split-heading";

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

export default function AskBar({ heading, sub }) {
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
    const trip = encodeTrip({ ...PLAN_DEFAULTS, destination: where });
    router.push(trip ? `/plan?trip=${trip}` : "/plan");
  }

  return (
    <div className="w-full">
      {/* Optional: the homepage now places the bar inside a section that
          has its own heading, so heading and sub render only when given. */}
      {heading && (
        <SplitHeading
          text={heading}
          className="font-display text-[40px] font-black leading-[1.02] tracking-tight text-ink-text [text-wrap:balance] sm:text-[64px] lg:text-[76px]"
        />
      )}
      {sub && (
        <p
          className="animate-fade-up mt-4 max-w-md text-[15px] leading-relaxed text-ink-text-muted sm:text-[17px]"
          style={{ "--fade-delay": "550ms" }}
        >
          {sub}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          go();
        }}
        className={heading ? "animate-fade-up mt-6" : ""}
        style={heading ? { "--fade-delay": "700ms" } : undefined}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-ink-line-strong bg-ink-soft/70 p-2 backdrop-blur focus-within:border-accent/60">
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Where do you want to go?"
            aria-label="Where do you want to go?"
            enterKeyHint="go"
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[16px] text-ink-text outline-none placeholder:text-ink-text-faint"
          />

          {supported && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={listening ? "Stop listening" : "Speak instead of typing"}
              aria-pressed={listening}
              // A real, tappable target in the thumb zone — not a small grey
              // icon. 44px is the floor for a touch target.
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                listening ? "bg-accent text-white" : "bg-ink/60 text-ink-text-muted"
              }`}
            >
              <MicIcon active={listening} />
            </button>
          )}

          <button
            type="submit"
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 text-[14.5px] font-bold text-white"
          >
            <SparkleIcon size={15} />
            <span className="hidden sm:inline">Plan it</span>
            <ChevronIcon size={14} />
          </button>
        </div>

        {listening && (
          <p className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Listening — say a place, in English or Hindi
          </p>
        )}

        {error && (
          <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-text-muted">
            <AlertIcon size={13} /> {error}
          </p>
        )}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((place) => (
          <button
            key={place}
            type="button"
            onClick={() => go(place)}
            className="rounded-full border border-ink-line-strong px-3.5 py-1.5 text-[13px] font-semibold text-ink-text-muted transition-colors hover:border-accent/60 hover:text-ink-text"
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
