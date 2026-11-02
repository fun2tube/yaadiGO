"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, PAYMENT_METHODS } from "@/lib/crm/schema";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * Record money that did not come through the payment link.
 *
 * The quotation tells customers to pay by bank transfer or Google Pay, and
 * until 2026-10-14 there was nowhere to write that down: the API existed and
 * no screen called it, so "Collected" stayed ₹0 on every booking paid that way
 * and every report of money received was wrong (review
 * 2026-10-14-full-function-test, F2).
 *
 * The amount defaults to the advance when nothing has been collected yet
 * (that is what the customer was asked for) and to the outstanding balance
 * after that. An overpayment is allowed but asked about twice.
 */

const METHODS = PAYMENT_METHODS.filter((m) => m !== "Payment link");

function today() {
  // The date input wants local YYYY-MM-DD; toISOString would give UTC and
  // record a payment made at 1 a.m. IST on the previous day.
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function RecordPayment({ booking, outstanding, needsConfirmation, readOnly = false, payments = [] }) {
  const collected = booking.collected ?? 0;
  const suggested = collected > 0 ? outstanding : Math.min(booking.advance || outstanding, outstanding);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("payment");
  const [amount, setAmount] = useState(String(suggested || ""));
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmOver, setConfirmOver] = useState(null);
  const [done, setDone] = useState(null);
  const router = useRouter();

  async function submit(allowOverpayment = false) {
    setBusy(true);
    setError(null);
    try {
      const value = Number(amount);
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          amount: value,
          kind: kind === "refund" ? "refund" : collected > 0 ? "instalment" : "advance",
          method,
          reference: reference.trim() || undefined,
          // Noon IST on the chosen day, so no timezone ever moves it to
          // another date.
          receivedAt: `${date}T12:00:00+05:30`,
          allowOverpayment,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.needsConfirmation) {
        setConfirmOver(data.message);
        return;
      }
      if (!response.ok) {
        setError(data.message ?? "Could not record the payment.");
        return;
      }
      setDone(`${kind === "refund" ? "Refund" : "Payment"} of ${money(Math.abs(value))} recorded.`);
      setConfirmOver(null);
      setOpen(false);
      setReference("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-paper-line-strong bg-paper px-3 py-2.5 text-[14px] text-paper-text";
  const label = "block font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint";

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[14px] font-bold text-paper-text">Payments received</h3>
        {!open && !needsConfirmation && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(null);
            }}
            className="shrink-0 rounded-xl border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-bold text-paper-text"
          >
            Record a payment
          </button>
        )}
      </div>

      {needsConfirmation && !readOnly && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-paper-text-muted">
          Confirm this booking on the bookings board first — that holds the seats on the batch —
          then record what the customer paid.
        </p>
      )}

      {done && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-good">
          <CheckIcon size={13} /> {done}
        </p>
      )}

      {open && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <div className="flex gap-1.5" role="radiogroup" aria-label="Money in or out">
            {[
              ["payment", "Money in"],
              ["refund", "Refund"],
            ].map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => {
                  setKind(value);
                  setAmount(value === "refund" ? "" : String(suggested || ""));
                }}
                disabled={value === "refund" && collected <= 0}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40 ${
                  kind === value
                    ? "border-ink bg-ink text-ink-text"
                    : "border-paper-line-strong text-paper-text-muted"
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={label}>Amount ₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${field} mt-1.5 font-semibold`}
              />
            </label>
            <label>
              <span className={label}>How it was paid</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={`${field} mt-1.5`}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>Reference (UTR, cheque no.)</span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                placeholder="Optional"
                className={`${field} mt-1.5`}
              />
            </label>
            <label>
              <span className={label}>Date received</span>
              <input
                type="date"
                required
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${field} mt-1.5`}
              />
            </label>
          </div>

          <p className="text-[11.5px] text-paper-text-faint">
            {kind === "refund"
              ? `${money(collected)} collected so far.`
              : `${money(outstanding)} outstanding${
                  collected === 0 && booking.advance ? ` · advance asked ${money(booking.advance)}` : ""
                }.`}
          </p>

          {confirmOver && (
            <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-[12.5px] text-paper-text">
              <p>{confirmOver}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={busy}
                  className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-ink-text disabled:opacity-50"
                >
                  Yes, record it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOver(null)}
                  className="rounded-lg border border-paper-line-strong px-3 py-1.5 text-[12px] font-semibold text-paper-text-muted"
                >
                  Change the amount
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12.5px] text-danger">
              <AlertIcon size={14} />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !(Number(amount) > 0)}
              className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-bold text-ink-text disabled:opacity-40"
            >
              {busy ? "Saving…" : kind === "refund" ? "Record refund" : "Record payment"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setConfirmOver(null);
              }}
              className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13.5px] font-semibold text-paper-text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {payments.length === 0 ? (
        !open && (
          <p className="mt-2 text-[12.5px] text-paper-text-faint">Nothing received yet.</p>
        )
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-paper-line border-t border-paper-line">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
              <span className="min-w-0 text-paper-text-muted">
                <span className="font-mono text-[10.5px] text-paper-text-faint">
                  {new Date(p.receivedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>{" "}
                · {p.method}
                {p.reference ? ` · ${p.reference}` : ""}
                {p.recordedByName ? ` · by ${p.recordedByName}` : ""}
              </span>
              <span className={`shrink-0 font-semibold ${p.amount < 0 ? "text-danger" : "text-good"}`}>
                {p.amount < 0 ? "−" : ""}
                {money(Math.abs(p.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
