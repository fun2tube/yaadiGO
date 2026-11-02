"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon } from "@/components/icons";
import PdfDownloadButton from "@/components/pdf-download-button";

/**
 * What the desk can do with a quotation that already exists.
 *
 * The customer link is shown as copyable text rather than only emailed,
 * because a salesperson on the phone wants to paste it into WhatsApp there and
 * then — which is how most of these actually reach people.
 */
export default function QuoteActions({ quotation, canWrite }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/q/${quotation.token}` : "";

  async function act(action) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quotation.id, action }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      // A revision is a different record — stay on the old one and the editor
      // would be pointed at a quotation that is no longer the live draft.
      if (action === "revise" && data.quotation?.id) {
        router.push(`/admin/quotations/${data.quotation.id}`);
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-4">
      {quotation.status === "draft" ? (
        <>
          <p className="text-[13px] font-semibold text-paper-text">
            Not sent yet — the customer cannot see this.
          </p>
          {canWrite && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act("send")}
              className="mt-2.5 w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send to customer"}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
            Customer link
          </p>
          <div className="mt-1.5 flex gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-lg border border-paper-line-strong bg-paper px-2.5 py-2 font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-lg bg-ink px-3 py-2 text-[12px] font-bold text-ink-text"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {quotation.status === "sent" && canWrite && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => act("approve")}
                className="flex-1 rounded-xl border border-good/40 px-3.5 py-2.5 text-[12.5px] font-bold text-good disabled:opacity-40"
              >
                Mark approved
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => act("reject")}
                className="flex-1 rounded-xl border border-paper-line-strong px-3.5 py-2.5 text-[12.5px] font-semibold text-paper-text-muted disabled:opacity-40"
              >
                Mark declined
              </button>
            </div>
          )}

          {quotation.status === "approved" && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-good">
              <CheckIcon size={13} /> Approved — a booking was created from this.
            </p>
          )}

          {/* Reworking a price is the most common thing that happens after a
              quotation is sent, and until now the error message told people to
              do something the system could not do. */}
          {canWrite && ["sent", "rejected", "expired"].includes(quotation.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act("revise")}
              className="mt-3 w-full rounded-xl border border-accent px-4 py-2.5 text-[13px] font-bold text-accent-deep disabled:opacity-40"
            >
              {busy ? "Creating…" : `Create v${quotation.version + 1}`}
            </button>
          )}
        </>
      )}

      {/* The quotation as a file, in its chosen template — what most
          customers actually receive, on WhatsApp. A draft's file says
          "Draft" across the top so it cannot pass for the final. */}
      <div className="mt-3">
        <PdfDownloadButton
          href={`/api/admin/quotations/${quotation.id}/pdf`}
          label={quotation.status === "draft" ? "Download draft PDF" : "Download PDF"}
          filename={`YaadiGo-Quotation-v${quotation.version}.pdf`}
          fullWidth
          className="w-full rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-bold text-paper-text transition-colors hover:border-accent"
        />
      </div>

      {/* Discarding an unsent draft.
          `reviseQuotation` refuses while an unsent draft exists and tells you
          to "finish or discard it" — and there was no discard, so a draft
          nobody wanted blocked every future quotation on that lead
          permanently. Confirmed because it is one-way. */}
      {canWrite && quotation.status === "draft" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Discard this draft? It has not been sent, and this cannot be undone.")) {
              act("discard");
            }
          }}
          className="mt-3 w-full rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-bold text-paper-text-muted disabled:opacity-40"
        >
          {busy ? "Discarding…" : "Discard this draft"}
        </button>
      )}

      {error && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
          <AlertIcon size={13} /> {error}
        </p>
      )}
    </div>
  );
}
