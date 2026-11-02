"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/crm/schema";
import { AlertIcon } from "@/components/icons";

/**
 * Hand a booking to operations.
 *
 * Explicit, never automatic on payment. Operations starts committing real money
 * with suppliers the moment they pick it up — a hotel deposit, a flight — and
 * "the system moved it" is not a good enough reason to have spent it.
 *
 * The confirmation states the outstanding balance out loud. Not as a block:
 * sometimes you hold a hotel on trust before the balance lands. But nobody
 * should commit spend without having seen the number.
 */
export default function HandoverButton({ booking, outstanding, staff }) {
  const [confirming, setConfirming] = useState(false);
  const [opsOwnerId, setOpsOwnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const opsTeam = staff.filter((u) => u.role === "ops" || u.role === "admin");

  const ready = ["confirmed", "part-paid", "paid"].includes(booking.status);

  if (!ready) {
    return (
      <p className="rounded-2xl border border-paper-line bg-paper-dim px-4 py-3 text-[12.5px] leading-relaxed text-paper-text-muted">
        Confirm this booking before handing it to operations.
      </p>
    );
  }

  async function hand() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/operations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, opsOwnerId: opsOwnerId || null }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-xl bg-accent px-5 py-3.5 text-[14.5px] font-bold text-white"
      >
        Hand to operations
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-warn/40 bg-warn/10 p-4">
      <p className="text-[13.5px] font-bold text-paper-text">Hand this to operations?</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
        They will start booking flights, hotels and transport against it.
        {outstanding > 0 ? (
          <>
            {" "}
            <strong className="font-bold text-warn">
              {money(outstanding)} is still outstanding.
            </strong>
          </>
        ) : (
          " This booking is paid in full."
        )}
      </p>

      {opsTeam.length > 0 && (
        <label className="mt-3 flex flex-col gap-1">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
            Assign to
          </span>
          <select
            value={opsOwnerId}
            onChange={(e) => setOpsOwnerId(e.target.value)}
            className="w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent"
          >
            <option value="">Anyone in operations</option>
            {opsTeam.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
          <AlertIcon size={13} /> {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={hand}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-[13.5px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "Handing over…" : "Yes, hand it over"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-xl border border-paper-line-strong px-4 py-3 text-[13px] font-semibold text-paper-text-muted"
        >
          Not yet
        </button>
      </div>
    </div>
  );
}
