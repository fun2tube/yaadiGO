"use client";

import { useConcierge } from "./concierge-provider";
import { SparkleIcon } from "@/components/icons";

/**
 * The way in.
 *
 * Desktop: a labelled pill bottom-right, above the WhatsApp button.
 * Mobile: a compact pill that floats just above the bottom tab bar — high
 * enough to clear the bar and the home indicator, small enough not to sit on
 * top of the content someone is reading.
 *
 * Hidden entirely while the panel is open so it never doubles up with it.
 */
export default function ConciergeLauncher() {
  const { open, openPanel } = useConcierge();

  if (open) return null;

  return (
    <>
      {/* Desktop */}
      <button
        type="button"
        onClick={openPanel}
        className="no-print group fixed bottom-24 right-6 z-40 hidden items-center gap-2.5 rounded-full bg-ink py-3.5 pl-4 pr-5 text-[14px] font-bold text-ink-text shadow-xl shadow-ink/25 transition-transform hover:scale-105 md:flex"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
          <SparkleIcon size={14} />
        </span>
        Ask Yaadi
      </button>

      {/* Mobile */}
      <button
        type="button"
        onClick={openPanel}
        className="no-print fixed right-4 z-40 flex items-center gap-2 rounded-full bg-ink py-2.5 pl-3 pr-4 text-[13px] font-bold text-ink-text shadow-xl shadow-ink/30 transition-transform active:scale-95 md:hidden"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
          <SparkleIcon size={12} />
        </span>
        Ask
      </button>
    </>
  );
}
