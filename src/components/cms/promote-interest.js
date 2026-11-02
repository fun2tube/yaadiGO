"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Turn a demand signal into a lead by adding a contact.
 *
 * The missing half is always the same — a phone number or an email — so this
 * asks for exactly that and nothing else. Everything else the conversation
 * already revealed (destination, month, group size, budget, the transcript)
 * travels across on its own.
 */
export default function PromoteInterest({ conversationId }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function promote() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, name, phone, email }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message ?? "Couldn't do that.");
        return;
      }
      // Straight to the lead: the next thing anybody does is call them.
      router.push(`/admin/leads/${body.leadId}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full border border-paper-line-strong px-3.5 py-1.5 text-[12.5px] font-bold text-paper-text"
      >
        Add a contact
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[260px]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional)"
        className="rounded-lg border border-paper-line-strong bg-paper px-2.5 py-1.5 text-[12.5px]"
      />
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          inputMode="tel"
          className="min-w-0 flex-1 rounded-lg border border-paper-line-strong bg-paper px-2.5 py-1.5 text-[12.5px]"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          inputMode="email"
          className="min-w-0 flex-1 rounded-lg border border-paper-line-strong bg-paper px-2.5 py-1.5 text-[12.5px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={promote}
          // One of the two is enough, and requiring both loses leads that only
          // gave a number.
          disabled={busy || (!phone.trim() && !email.trim())}
          className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Make it a lead"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12.5px] font-semibold text-paper-text-muted"
        >
          Cancel
        </button>
      </div>
      {error ? <p className="text-[12px] font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
