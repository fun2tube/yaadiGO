"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STAGES, LOST_REASONS, TONE_CLASSES } from "@/lib/crm/schema";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * The three things a salesperson changes on a lead: the stage, when it is next
 * due, and who owns it.
 *
 * Stage and follow-up are one action on purpose. "Called, ringing back
 * Thursday" is a single thought, and splitting it into two forms is how the
 * follow-up date ends up never being set.
 */

const field =
  "w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent";
const label = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";

/** Shortcuts, because nobody wants a date picker to say "tomorrow". */
function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function LeadActions({ lead, staff, currentUserId }) {
  const [stage, setStage] = useState(lead.status ?? "new");
  const [followUpAt, setFollowUpAt] = useState(lead.followUpAt?.slice(0, 10) ?? "");
  const [lostReason, setLostReason] = useState(lead.lostReason ?? LOST_REASONS[0]);
  const [note, setNote] = useState("");

  const [transferring, setTransferring] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const router = useRouter();

  const closing = stage === "won" || stage === "lost";
  const dirty =
    stage !== (lead.status ?? "new") ||
    followUpAt !== (lead.followUpAt?.slice(0, 10) ?? "") ||
    note.trim().length > 0;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          status: stage,
          followUpAt: closing ? null : followUpAt || null,
          lostReason: stage === "lost" ? lostReason : undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      setNote("");
      setSaved("Saved.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function transfer() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, toUserId: transferTo, reason: transferReason }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      setTransferring(false);
      setTransferReason("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const colleagues = staff.filter((u) => u.id !== lead.ownerId && u.role !== "ops");

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-4">
      <p className={label}>Stage</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {LEAD_STAGES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStage(option.value)}
            title={option.hint}
            className={`rounded-lg px-2.5 py-1.5 font-mono text-[10.5px] font-bold transition-all ${
              stage === option.value
                ? TONE_CLASSES[option.tone]
                : "border border-paper-line-strong text-paper-text-muted hover:border-accent"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {stage === "lost" && (
        <label className="mt-3 flex flex-col gap-1">
          <span className={label}>Why?</span>
          <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className={field}>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Hidden once closed: a won or lost lead sitting in someone's overdue
          list forever is how a useful list stops being opened. */}
      {!closing && (
        <div className="mt-4">
          <p className={label}>Follow up</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "Today", value: inDays(0) },
              { label: "Tomorrow", value: inDays(1) },
              { label: "In 3 days", value: inDays(3) },
              { label: "Next week", value: inDays(7) },
            ].map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => setFollowUpAt(shortcut.value)}
                className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-all ${
                  followUpAt === shortcut.value
                    ? "bg-accent text-white"
                    : "border border-paper-line-strong text-paper-text-muted"
                }`}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
            className={`${field} mt-2`}
          />
        </div>
      )}

      <label className="mt-4 flex flex-col gap-1">
        <span className={label}>Add a note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Called — wants to move to November"
          className={`${field} resize-y`}
        />
      </label>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
          <AlertIcon size={13} /> {error}
        </p>
      )}
      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-good">
          <CheckIcon size={13} /> {saved}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy || !dirty}
        className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : dirty ? "Save" : "No changes"}
      </button>

      {/* Transfer */}
      <div className="mt-4 border-t border-paper-line pt-3.5">
        {transferring ? (
          <>
            <p className={label}>Transfer to</p>
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className={`${field} mt-1.5`}
            >
              <option value="">Choose a colleague</option>
              {colleagues.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email} · {u.role}
                </option>
              ))}
            </select>
            {/* Mandatory. An unexplained reassignment reads as blame, and the
                next owner needs to know what has already been tried. */}
            <input
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Why? They asked for a Hindi speaker…"
              className={`${field} mt-2`}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={transfer}
                disabled={busy || !transferTo || !transferReason.trim()}
                className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-ink-text disabled:opacity-40"
              >
                Transfer
              </button>
              <button
                type="button"
                onClick={() => setTransferring(false)}
                className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[12.5px] font-semibold text-paper-text-muted"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setTransferring(true)}
            className="text-[12.5px] font-bold text-accent-deep"
          >
            {lead.ownerId === currentUserId ? "Transfer this lead" : "Reassign"}
          </button>
        )}
      </div>
    </div>
  );
}
