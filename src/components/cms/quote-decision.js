"use client";

import { useState } from "react";
import { money } from "@/lib/crm/schema";
import { CheckIcon, AlertIcon } from "@/components/icons";

/**
 * The customer's decision.
 *
 * Approving is one tap; declining asks why, because "they said no" without a
 * reason is the least useful thing a CRM can record. Neither is destructive —
 * the desk can always rework and re-send.
 */
export default function QuoteDecision({ token, total }) {
  const [mode, setMode] = useState(null); // null | "reject"
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  async function decide(decision) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/q/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "That didn't go through.");
        return;
      }
      setDone(decision);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        className={`no-print mt-7 rounded-2xl border p-5 ${
          done === "approved" ? "border-good/40 bg-good/10" : "border-paper-line bg-paper-dim"
        }`}
      >
        <p className="flex items-center gap-2 text-[14.5px] font-bold text-paper-text">
          <CheckIcon size={15} />
          {done === "approved" ? "Thank you — we're on it." : "Thanks for letting us know."}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-paper-text-muted">
          {done === "approved"
            ? "A travel expert will call shortly to confirm dates and arrange the advance."
            : "We'll be in touch to see what would work better."}
        </p>
      </div>
    );
  }

  return (
    <div className="no-print mt-7 rounded-2xl border border-accent/30 bg-accent/5 p-5">
      <p className="text-[15px] font-bold text-paper-text">Happy with this?</p>
      <p className="mt-1 text-[13px] leading-relaxed text-paper-text-muted">
        Approving tells the desk to hold it at {money(total)} and call you. Nothing is charged
        here.
      </p>

      {mode === "reject" ? (
        <div className="mt-3.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What would work better? Price, dates, hotels…"
            className="w-full rounded-xl border border-paper-line-strong bg-paper px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("rejected")}
              className="flex-1 rounded-xl bg-ink px-4 py-3 text-[14px] font-bold text-ink-text disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send this back"}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="rounded-xl border border-paper-line-strong px-4 py-3 text-[13px] font-semibold text-paper-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide("approved")}
            className="flex-1 rounded-xl bg-accent px-5 py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Confirming…" : "Approve this quotation"}
          </button>
          <button
            type="button"
            onClick={() => setMode("reject")}
            className="rounded-xl border border-paper-line-strong px-5 py-3.5 text-[14px] font-semibold text-paper-text-muted"
          >
            Ask for changes
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
          <AlertIcon size={13} /> {error}
        </p>
      )}
    </div>
  );
}
