"use client";

import { useSyncExternalStore } from "react";

/**
 * Live "is the desk open" indicator, in IST.
 *
 * The clock is an external, changing source, so it is read with
 * useSyncExternalStore rather than an effect that sets state: the server
 * snapshot is null (renders nothing), the client snapshot is the current
 * minute, and React handles the hydration boundary. A status light that
 * flickers to the wrong state for one frame is worse than one that arrives a
 * moment late.
 *
 * Desk hours are the ones the site commits to elsewhere: 10 AM–7 PM IST,
 * with 24×7 cover for live-trip emergencies.
 */

const OPEN_HOUR = 10;
const CLOSE_HOUR = 19;

/** Ticks once a minute. The snapshot is a minute bucket, so it is referentially
 *  stable within a minute and React does not re-render on every check. */
function subscribe(onChange) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

const getSnapshot = () => Math.floor(Date.now() / 60_000);
const getServerSnapshot = () => null;

function istNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: get("hour"), minute: get("minute") };
}

export default function DeskStatus({ tone = "dark", showClock = true }) {
  const minute = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Server render and first hydration pass: show nothing rather than guess.
  if (minute === null) return null;

  const { hour, minute: min } = istNow();
  const open = hour >= OPEN_HOUR && hour < CLOSE_HOUR;
  const clock = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

  const muted = tone === "dark" ? "text-ink-text-faint" : "text-paper-text-faint";
  const strong = tone === "dark" ? "text-ink-text-muted" : "text-paper-text-muted";

  return (
    <span className={`flex items-center gap-2 font-mono text-[11px] ${muted}`}>
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {open && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${open ? "bg-good" : "bg-warn"}`}
        />
      </span>
      <span className={strong}>{open ? "Desk open" : "Desk closed"}</span>
      {showClock && (
        <>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{clock} IST</span>
        </>
      )}
    </span>
  );
}
