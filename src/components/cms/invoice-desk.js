"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon, ChevronIcon, ReceiptIcon } from "@/components/icons";
import { GST_STATES, validGstin, stateOfGstin } from "@/lib/crm/gst";

/**
 * Raising and listing tax invoices.
 *
 * `canIssue` comes from the server (`invoices.write`) and the API checks it
 * again. The button is hidden rather than disabled for anyone without it: a
 * salesperson should not be shown a control that exists to be refused.
 *
 * `blocker` is the server's reason invoices cannot be raised at all (no
 * company GSTIN). It is shown before anyone tries, instead of a button that
 * fails.
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

const field =
  "w-full rounded-xl border border-paper-line-strong bg-paper px-3 py-2.5 text-[13.5px] text-paper-text";
const label = "block font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint";

/** The three facts accounts confirms before a number is burned. */
function RaisePanel({ booking, sellerStateCode, busy, onRaise, onCancel }) {
  const [gstin, setGstin] = useState("");
  const [place, setPlace] = useState(sellerStateCode ?? "07");
  const [address, setAddress] = useState("");
  const cleanGstin = gstin.trim().toUpperCase();
  const gstinBad = cleanGstin.length > 0 && !validGstin(cleanGstin);

  return (
    <div className="mt-3 flex w-full flex-col gap-3 border-t border-paper-line pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={label}>Customer GSTIN (if registered)</span>
          <input
            value={gstin}
            onChange={(e) => {
              setGstin(e.target.value);
              // A registered buyer's place of supply is their own state.
              const state = stateOfGstin(e.target.value.trim().toUpperCase());
              if (state) setPlace(state.code);
            }}
            maxLength={15}
            placeholder="Leave blank for an individual"
            className={`${field} mt-1.5 font-mono uppercase`}
          />
          {gstinBad && (
            <span className="mt-1 block text-[11.5px] text-danger">
              15 characters, starting with the state code.
            </span>
          )}
        </label>
        <label>
          <span className={label}>Place of supply</span>
          <select value={place} onChange={(e) => setPlace(e.target.value)} className={`${field} mt-1.5`}>
            {GST_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11.5px] text-paper-text-faint">
            {place === sellerStateCode ? "Same state — CGST + SGST." : "Another state — IGST."}
          </span>
        </label>
      </div>
      <label>
        <span className={label}>Customer billing address (optional)</span>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          maxLength={400}
          className={`${field} mt-1.5 resize-y`}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || gstinBad}
          onClick={() =>
            onRaise(booking.id, {
              customerGstin: cleanGstin || undefined,
              placeOfSupplyCode: place,
              customerAddress: address.trim() || undefined,
            })
          }
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-ink-text disabled:opacity-50"
        >
          {busy ? "Raising…" : `Raise invoice for ${money(booking.total)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-paper-line-strong px-4 py-2 text-[13px] font-semibold text-paper-text-muted"
        >
          Not yet
        </button>
      </div>
      <p className="text-[11.5px] leading-relaxed text-paper-text-faint">
        The number is allocated the moment you press it, and the invoice cannot be edited after.
      </p>
    </div>
  );
}

export default function InvoiceDesk({
  invoices,
  awaiting,
  credited = {},
  canIssue,
  blocker = null,
  sellerStateCode = null,
}) {
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function issue(bookingId, details) {
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, ...details }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Could not raise the invoice.");
      setOpenId(null);
      router.push(`/admin/invoices/${data.invoice.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {blocker && (
        <p className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3 text-[13px] leading-relaxed text-paper-text">
          <AlertIcon size={14} className="mt-0.5 shrink-0" /> {blocker}
        </p>
      )}

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
            Every confirmed booking has been invoiced. Seat requests appear here once the desk
            confirms them.
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
                {canIssue && !blocker ? (
                  openId !== booking.id && (
                    <button
                      type="button"
                      onClick={() => setOpenId(booking.id)}
                      className="shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-ink-text"
                    >
                      Raise invoice
                    </button>
                  )
                ) : (
                  <span className="shrink-0 text-[12px] text-paper-text-faint">
                    {canIssue ? "Set the company GSTIN first" : "Accounts raises this"}
                  </span>
                )}
                {openId === booking.id && (
                  <RaisePanel
                    booking={booking}
                    sellerStateCode={sellerStateCode}
                    busy={busyId === booking.id}
                    onRaise={issue}
                    onCancel={() => setOpenId(null)}
                  />
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
              <Link
                key={invoice.id}
                href={`/admin/invoices/${invoice.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper-line bg-card px-4 py-3 hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[14px] font-semibold text-paper-text">
                    <ReceiptIcon size={13} /> {invoice.number}
                    {credited[invoice.id] ? (
                      <span className="rounded bg-danger/10 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-danger">
                        {credited[invoice.id] >= invoice.total ? "CREDITED IN FULL" : "PART CREDITED"}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-paper-text-muted">
                    {invoice.title ?? "Trip"} · {invoice.customer?.name ?? "—"} ·{" "}
                    {when(invoice.issuedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div>
                    <p className="text-[14px] font-bold text-paper-text">{money(invoice.total)}</p>
                    <p className="text-[11.5px] text-paper-text-faint">
                      incl. {invoice.taxPercent ?? 0}% GST
                    </p>
                  </div>
                  <ChevronIcon size={13} className="text-paper-text-faint" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {invoices.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] text-paper-text-faint">
            <CheckIcon size={12} className="mt-0.5 shrink-0" />
            Numbers are sequential per financial year and immutable. Open an invoice to print it or
            to issue a credit note against it.
          </p>
        )}
      </section>
    </div>
  );
}
