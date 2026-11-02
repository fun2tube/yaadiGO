"use client";

import { useState } from "react";

/**
 * Downloads a server-rendered PDF — no print dialog.
 *
 * Fetches rather than following a plain link because a render takes a few
 * seconds (longer on a cold start), and a link gives no sign anything is
 * happening; people tap again and get two files. With `body` it POSTs JSON
 * (the planner's itinerary, which exists only in this browser).
 *
 * If the server cannot render, it says so in one sentence and offers the
 * browser's own print as a fallback — never a button that silently does
 * nothing.
 */
export default function PdfDownloadButton({
  href,
  body = null,
  filename = "YaadiGo.pdf",
  label = "Download PDF",
  disabled = false,
  fullWidth = false,
  className = "",
}) {
  const [state, setState] = useState("idle"); // idle | busy | error
  const [message, setMessage] = useState("");

  async function download() {
    setState("busy");
    setMessage("");
    try {
      const response = await fetch(href, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message ?? "The PDF couldn't be made just now.");
      }

      const blob = await response.blob();
      const named = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = named ?? filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked after the click has been handled, not synchronously — Safari
      // cancels a download whose object URL disappears in the same tick.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
    } catch (error) {
      setMessage(error?.message || "The PDF couldn't be made just now.");
      setState("error");
    }
  }

  const busy = state === "busy";

  return (
    <span
      className={`no-print flex-col gap-1.5 ${fullWidth ? "flex w-full items-stretch" : "inline-flex items-start"}`}
    >
      <button
        type="button"
        onClick={download}
        disabled={disabled || busy}
        aria-busy={busy}
        className={`inline-flex items-center justify-center gap-2 disabled:opacity-60 ${className}`}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
            <path
              d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {busy ? "Preparing PDF…" : label}
      </button>
      {state === "error" && (
        <span role="alert" className="max-w-xs text-[12.5px] leading-snug text-danger">
          {message}{" "}
          <button
            type="button"
            onClick={() => window.print()}
            className="font-semibold text-paper-text underline underline-offset-2"
          >
            Print instead
          </button>
        </span>
      )}
    </span>
  );
}
