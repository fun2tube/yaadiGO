"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronIcon, AlertIcon, WhatsAppIcon } from "@/components/icons";

/**
 * The lead inbox.
 *
 * Built around the one question a travel desk asks all day: who do I call
 * next. So it sorts newest-first, shows the phone number as a tap-to-call
 * link on the card itself, and puts the status change one tap away — nobody
 * should have to open a record to mark it contacted.
 */

const STATUSES = [
  { value: "new", label: "New", className: "bg-accent/15 text-accent-deep" },
  { value: "contacted", label: "Contacted", className: "bg-paper-line-strong text-paper-text-muted" },
  { value: "quoted", label: "Quoted", className: "bg-warn/20 text-warn" },
  { value: "won", label: "Won", className: "bg-good/15 text-good" },
  { value: "lost", label: "Lost", className: "bg-danger/10 text-danger" },
];

const SOURCE_LABELS = {
  "fixed-departure-booking": "Booking request",
  "customised-package": "Destination enquiry",
  "ai-planner": "AI planner",
  concierge: "Yaadi chat",
  "corporate-desk": "Corporate",
  "contact-page": "Contact page",
  "trip-builder": "Trip builder",
};

function when(iso) {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StatusPill({ status }) {
  const meta = STATUSES.find((s) => s.value === status) ?? STATUSES[0];
  return (
    <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function LeadCard({ lead, onPatch, busy }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const status = lead.status ?? "new";

  return (
    <article className="overflow-hidden rounded-2xl border border-paper-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-paper-text">{lead.name}</span>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-paper-text-faint">
            <span>{SOURCE_LABELS[lead.source] ?? lead.source}</span>
            <span aria-hidden="true">·</span>
            <span>{when(lead.receivedAt ?? lead.createdAt)}</span>
            {lead.destination && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-paper-text-muted">{lead.destination}</span>
              </>
            )}
          </p>
        </div>
        <ChevronIcon
          size={14}
          className={`mt-1 shrink-0 text-paper-text-faint transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {/* Contact actions stay on the card — calling is the whole job. */}
      <div className="flex flex-wrap gap-2 border-t border-paper-line px-4 py-2.5">
        {lead.phone && (
          <>
            <a
              href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
              className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-ink-text"
            >
              Call {lead.phone}
            </a>
            <a
              href={`https://wa.me/${lead.phone.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[12px] font-bold text-white"
            >
              <WhatsAppIcon size={13} /> WhatsApp
            </a>
          </>
        )}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="rounded-lg border border-paper-line-strong px-3 py-1.5 text-[12px] font-semibold text-paper-text-muted"
          >
            Email
          </a>
        )}
      </div>

      {open && (
        <div className="border-t border-paper-line px-4 py-3.5">
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => onPatch(lead.id, { status: option.value })}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition-all ${
                  status === option.value
                    ? "bg-accent text-white"
                    : "border border-paper-line-strong text-paper-text-muted hover:border-accent/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {[
              ["Destination", lead.destination],
              ["Dates", lead.dates],
              ["Travellers", lead.groupSize],
              ["Budget", lead.budget],
              ["Company", lead.company],
              ["Role", lead.role],
              ["Interests", lead.interests?.length ? lead.interests.join(", ") : null],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-[13px] text-paper-text">{value}</dd>
                </div>
              ))}
          </dl>

          {lead.message && (
            <div className="mt-3.5">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                What they said
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-paper-dim p-3 text-[12.5px] leading-relaxed text-paper-text">
                {lead.message}
              </p>
            </div>
          )}

          {lead.itinerary && (
            <div className="mt-3.5 rounded-lg border border-accent/30 bg-accent/8 p-3">
              <p className="text-[12.5px] font-bold text-paper-text">
                AI itinerary attached — {lead.itinerary.title}
              </p>
              <p className="mt-0.5 text-[11.5px] text-paper-text-muted">
                {lead.itinerary.durationDays} days in {lead.itinerary.destination}
                {lead.itinerary.estimatedCostPerPerson &&
                  ` · ₹${lead.itinerary.estimatedCostPerPerson.min?.toLocaleString("en-IN")}–${lead.itinerary.estimatedCostPerPerson.max?.toLocaleString("en-IN")} pp`}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer font-mono text-[10.5px] text-accent-deep">
                  {lead.itinerary.days?.length ?? 0} days — show the plan
                </summary>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {lead.itinerary.days?.map((day) => (
                    <li key={day.day} className="text-[11.5px] leading-relaxed text-paper-text-muted">
                      <strong className="text-paper-text">Day {day.day}:</strong> {day.title}
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          )}

          {lead.notes?.length > 0 && (
            <div className="mt-3.5">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                Notes
              </p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {lead.notes.map((entry, i) => (
                  <li key={i} className="rounded-lg bg-paper-dim p-2.5">
                    <p className="text-[12.5px] leading-relaxed text-paper-text">{entry.body}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-paper-text-faint">
                      {new Date(entry.at).toLocaleString("en-IN")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              onPatch(lead.id, { note });
              setNote("");
            }}
            className="mt-3.5 flex gap-2"
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note after the call…"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[12.5px] outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !note.trim()}
              className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-ink-text disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

export default function LeadInbox({ initialLeads, initialCounts }) {
  const [leads, setLeads] = useState(initialLeads);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const visible = useMemo(
    () => (filter === "all" ? leads : leads.filter((lead) => (lead.status ?? "new") === filter)),
    [leads, filter]
  );

  async function patch(id, body) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Couldn't save that.");
        return;
      }
      // Patch in place rather than refetching — the desk is often on a phone
      // with a poor connection, and a full reload loses their scroll position.
      setLeads((prev) => prev.map((lead) => (lead.id === id ? data.lead : lead)));
      setCounts((prev) => {
        const next = { ...prev };
        const before = leads.find((lead) => lead.id === id)?.status ?? "new";
        const after = data.lead.status ?? "new";
        if (before !== after) {
          next[before] = Math.max((next[before] ?? 1) - 1, 0);
          next[after] = (next[after] ?? 0) + 1;
        }
        return next;
      });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const filters = [
    { value: "all", label: "All", count: leads.length },
    ...STATUSES.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] ?? 0 })),
  ];

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
              filter === item.value
                ? "border-ink bg-ink text-ink-text"
                : "border-paper-line-strong bg-card text-paper-text-muted hover:border-ink/40"
            }`}
          >
            {item.label} <span className="font-mono text-[11px] opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-[12.5px] font-semibold text-paper-text">
          <span className="mt-0.5 shrink-0 text-danger">
            <AlertIcon size={13} />
          </span>
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-paper-line-strong p-10 text-center">
          <p className="text-[14px] font-semibold text-paper-text">
            {leads.length === 0 ? "No leads yet" : "Nothing in this status"}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-paper-text-muted">
            {leads.length === 0
              ? "Every enquiry from the site lands here — the booking form, the AI planner, Yaadi, and the corporate desk."
              : "Try another filter."}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {visible.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onPatch={patch} busy={busy} />
          ))}
        </div>
      )}

      {leads.length > 0 && (
        <p className="mt-5 flex items-center gap-1.5 font-mono text-[10.5px] text-paper-text-faint">
          <CheckIcon size={11} /> {leads.length} total, newest first
        </p>
      )}
    </div>
  );
}
