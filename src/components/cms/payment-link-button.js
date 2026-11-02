"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/crm/schema";
import { renderMessage, whatsappTo, mailTo } from "@/lib/crm/messages";
import { WhatsAppIcon, CheckIcon, AlertIcon, WalletIcon } from "@/components/icons";

/**
 * Ask the customer for money.
 *
 * The one action that closes a sale, and until now the API existed with no
 * button behind it. The sequence matters: generate the link, then hand the
 * salesperson a pre-written WhatsApp message containing it, because a link the
 * customer never receives is worth nothing.
 *
 * The amount defaults to the advance on a booking with nothing paid, then to
 * the whole outstanding balance, which is what is wanted
 * almost every time and is one fewer number to get wrong on a call. It stays
 * editable for a part payment.
 *
 * The link is NOT auto-sent. The salesperson is usually on the phone to this
 * person and knows whether to WhatsApp it, email it or read it out — and a
 * payment request that arrives before the conversation that explains it reads
 * like a scam.
 */
export default function PaymentLinkButton({ booking, outstanding, me }) {
  // The advance first, if nothing has been paid — that is the figure on the
  // customer's quotation. After that, the whole balance.
  const [amount, setAmount] = useState(() => {
    const first = (booking.collected ?? 0) === 0 && booking.advance > 0;
    return String(first ? Math.min(booking.advance, outstanding) : outstanding ?? "");
  });
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const existing = booking.paymentLinks ?? [];

  if (outstanding <= 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-good/30 bg-good/10 px-4 py-3 text-[12.5px] font-semibold text-good">
        <CheckIcon size={14} /> Paid in full — nothing outstanding.
      </p>
    );
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/payments/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          amount: Number(amount) || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      setLink(data.link);
      // The link is recorded on the booking, so the page should show it.
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const message = link
    ? renderMessage("payment-link", { booking, amount: link.amount, me, url: link.url })
    : null;
  const wa = link ? whatsappTo(booking.phone, message) : null;
  const mail = link
    ? mailTo(booking.email, `Payment link — ${booking.tripTitle ?? "your trip"}`, message)
    : null;

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-4">
      <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-paper-text">
        <WalletIcon size={16} /> Collect payment
      </h3>

      {!link && (
        <>
          <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint">
            Amount to collect
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              max={outstanding}
              min={1}
              className="w-full rounded-xl border border-paper-line-strong bg-paper px-3 py-2.5 text-[14px] font-semibold text-paper-text"
            />
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create link"}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-paper-text-faint">
            {money(outstanding)} outstanding. UPI, card and net banking.
          </p>
        </>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-danger">
          <AlertIcon size={14} />
          {error}
        </p>
      )}

      {link && (
        <div className="mt-3">
          <p className="text-[12.5px] font-semibold text-good">
            Link ready for {money(link.amount)}
          </p>

          {/* Shown rather than hidden behind the buttons: sometimes the right
              move is to read it out or paste it somewhere else entirely. */}
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-paper-dim px-2.5 py-2 font-mono text-[11px] text-paper-text-muted">
              {link.url}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(link.url);
                setCopied(true);
              }}
              className="shrink-0 rounded-lg border border-paper-line-strong px-2.5 py-2 font-mono text-[10px] font-bold text-paper-text"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-[13.5px] font-bold text-white"
              >
                <WhatsAppIcon size={15} /> Send on WhatsApp
              </a>
            )}
            {mail && (
              <a
                href={mail}
                className="flex flex-1 items-center justify-center rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13.5px] font-bold text-paper-text"
              >
                Email it
              </a>
            )}
          </div>

          <p className="mt-2 text-[11.5px] leading-relaxed text-paper-text-faint">
            The payment records itself when they pay — you do not need to enter
            it again.
          </p>
        </div>
      )}

      {existing.length > 0 && (
        <p className="mt-3 border-t border-paper-line pt-2.5 text-[11.5px] text-paper-text-faint">
          {existing.length} link{existing.length === 1 ? "" : "s"} already sent — most recent{" "}
          {new Date(existing.at(-1).sentAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          })}
          . Check before sending another.
        </p>
      )}
    </div>
  );
}
