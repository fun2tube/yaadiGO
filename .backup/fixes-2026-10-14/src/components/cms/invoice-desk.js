"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon, ReceiptIcon } from "@/components/icons";

/**
 * Raising and listing tax invoices.
 *
 * `canIssue` comes from the server (`invoices.write`) and the API checks it
 * again. The button is hidden rather than disabled for anyone without it: a
 * salesperson should not be shown a control that exists to be refused.
 */

function money(rupees) {
  return `₹${Number(rupees ?? 0).toLocaleString("en-IN")}`;
}

function when(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InvoiceDesk({ invoices, awaiting, canIssue }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function issue(bookingId) {
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Could not raise the invoice.");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {error ? (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          <AlertIcon size={14} /> {error}
        </p>
      ) : null}

      {/* ------------------------------------------------ awaiting */}
      <section>
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          Awaiting an invoice ({awaiting.length})
        </h2>

        {awaiting.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-paper-line-strong p-5 text-center text-[12.5px] text-paper-text-muted">
            Every live booking has been invoiced.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {awaiting.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-line bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-paper-text">
                    {booking.tripTitle ?? "Trip"}{" "}
                    <span className="font-normal text-paper-text-muted">· {booking.name}</span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-paper-text-muted">
                    {booking.reference} · {booking.departureLabel ?? "dates to confirm"} ·{" "}
                    {money(booking.total)}
                  </p>
                </div>
                {canIssue ? (
                  <button
                    type="button"
                    onClick={() => issue(booking.id)}
                    disabled={busyId === booking.id}
                    className="shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-ink-text disabled:opacity-50"
                  >
                    {busyId === booking.id ? "Raising…" : "Raise invoice"}
                  </button>
                ) : (
                  <span className="shrink-0 text-[12px] text-paper-text-faint">
                    Accounts raises this
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------- raised */}
      <section>
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          Raised ({invoices.length})
        </h2>

        {invoices.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-paper-line-strong p-5 text-center text-[12.5px] text-paper-text-muted">
            No invoices yet.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-line bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[14px] font-semibold text-paper-text">
                    <ReceiptIcon size={13} /> {invoice.number}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-paper-text-muted">
                    {invoice.title ?? "Trip"} · {invoice.customer?.name ?? "—"} ·{" "}
                    {when(invoice.issuedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold text-paper-text">{money(invoice.total)}</p>
                  <p className="text-[11.5px] text-paper-text-faint">
                    incl. {invoice.taxPercent ?? 0}% GST
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {invoices.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] text-paper-text-faint">
            <CheckIcon size={12} className="mt-0.5 shrink-0" />
            Numbers are sequential per financial year and immutable. A mistake is corrected with a
            credit note, not an edit — that is still to be built.
          </p>
        )}
      </section>
    </div>
  );
}
