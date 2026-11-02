"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon } from "@/components/icons";

/**
 * Issue a credit note. Amount defaults to everything still un-credited, which
 * is the "cancel this invoice" case; a refund or a correction is typed in.
 * Asked twice, because the number it burns can never be reused.
 */
export default function CreditNoteForm({ invoiceId, remaining }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/invoices/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount: Number(amount), reason: reason.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message ?? "Could not issue the credit note.");
        setSure(false);
        return;
      }
      setOpen(false);
      setSure(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-paper-line-strong bg-paper px-3 py-2.5 text-[13.5px] text-paper-text";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-xl border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-bold text-paper-text"
      >
        Issue a credit note
      </button>
    );
  }

  const valid = Number(amount) > 0 && Number(amount) <= remaining && reason.trim().length >= 3;

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-paper-line pt-3">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label>
          <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint">
            Amount ₹ (incl. GST)
          </span>
          <input
            type="number"
            min={1}
            max={remaining}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setSure(false);
            }}
            className={`${field} mt-1.5 font-semibold`}
          />
        </label>
        <label>
          <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint">
            Reason
          </span>
          <input
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setSure(false);
            }}
            maxLength={500}
            placeholder="Trip cancelled by the customer; refund of ₹…"
            className={`${field} mt-1.5`}
          />
        </label>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger">
          <AlertIcon size={14} /> {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {sure ? (
          <button
            type="button"
            disabled={busy || !valid}
            onClick={submit}
            className="rounded-xl bg-danger px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "Issuing…" : "Yes — issue it (cannot be undone)"}
          </button>
        ) : (
          <button
            type="button"
            disabled={!valid}
            onClick={() => setSure(true)}
            className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-ink-text disabled:opacity-40"
          >
            Issue credit note
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSure(false);
            setError(null);
          }}
          className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-semibold text-paper-text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
