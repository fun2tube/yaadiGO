"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TRIP_KINDS, TRIP_STATUSES } from "@/lib/trip-model";
import { money } from "@/lib/crm/schema";
import { ChevronIcon, AlertIcon } from "@/components/icons";

const STATUS_CLASSES = {
  draft: "bg-paper-line-strong text-paper-text-muted",
  internal: "bg-warn/20 text-warn",
  published: "bg-good/15 text-good",
  archived: "bg-paper-line text-paper-text-faint",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "group", label: "Group tours" },
  { key: "customized", label: "Customized" },
  { key: "changes", label: "Unpublished changes" },
  { key: "archived", label: "Archived" },
];

/**
 * The trip list: find a trip, see its state at a glance, open it — or start a
 * new one. Each row answers "do I need to open this?" without opening it:
 * status, unpublished changes, next departure and seats for group trips.
 */
export default function TripList({ rows, canWrite, initialKind = "all" }) {
  const router = useRouter();
  const [filter, setFilter] = useState(initialKind);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState("group");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (filter === "archived" ? row.status !== "archived" : row.status === "archived" && filter !== "all") return false;
    if (filter === "group" && row.kind !== "group") return false;
    if (filter === "customized" && row.kind !== "customized") return false;
    if (filter === "changes" && !row.hasDraft) return false;
    if (needle && !`${row.title} ${row.destination}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/trips/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", kind, title }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      router.push(`/admin/trips/${data.trip.slug}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {canWrite && (
        <div className="mb-4 rounded-2xl border border-paper-line bg-card p-4">
          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-xl bg-accent px-5 py-3 text-[14px] font-bold text-white sm:w-auto"
            >
              + New trip
            </button>
          ) : (
            <form onSubmit={create} className="flex flex-col gap-3">
              <p className="text-[14px] font-bold text-paper-text">Start a new trip</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TRIP_KINDS.map((k) => (
                  <label
                    key={k.value}
                    className={`flex cursor-pointer flex-col rounded-xl border p-3 ${
                      kind === k.value ? "border-accent bg-accent/5" : "border-paper-line-strong"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[14px] font-bold text-paper-text">
                      <input
                        type="radio"
                        name="kind"
                        value={k.value}
                        checked={kind === k.value}
                        onChange={() => setKind(k.value)}
                      />
                      {k.label}
                    </span>
                    <span className="mt-1 text-[12.5px] text-paper-text-muted">{k.blurb}</span>
                  </label>
                ))}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[12.5px] font-semibold text-paper-text-muted">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ladakh in September"
                  required
                  minLength={3}
                  className="rounded-xl border border-paper-line-strong bg-paper px-3 py-3 text-[15px] outline-none focus:border-accent"
                />
              </label>
              {error && (
                <p className="flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
                  <AlertIcon size={13} /> {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-accent px-5 py-3 text-[14px] font-bold text-white disabled:opacity-50 sm:flex-none"
                >
                  {busy ? "Creating…" : "Create draft"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-xl border border-paper-line-strong px-4 py-3 text-[13.5px] font-semibold text-paper-text-muted"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[12px] text-paper-text-faint">
                It starts as a draft — only the team can see it until you publish.
              </p>
            </form>
          )}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trips…"
        className="w-full rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[14px] outline-none focus:border-accent"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold ${
              filter === f.key
                ? "border-ink bg-ink text-ink-text"
                : "border-paper-line-strong text-paper-text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {visible.map((row) => {
          const status = TRIP_STATUSES.find((s) => s.value === row.status);
          return (
            <Link
              key={row.slug}
              href={`/admin/trips/${row.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-paper-line bg-card p-3 transition-colors hover:border-accent/40"
            >
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-paper-dim">
                {row.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element -- a 56px admin thumbnail
                  <img src={row.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-bold text-paper-text">{row.title}</span>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${STATUS_CLASSES[row.status]}`}>
                    {status?.label}
                  </span>
                  {row.hasDraft && (
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-accent-deep">
                      Unpublished changes
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-paper-text-muted">
                  {row.kind === "group" ? "Group" : "Customized"} · {row.destination} · {row.duration}
                </span>
                <span className="mt-0.5 block text-[12px] text-paper-text-faint">
                  {row.kind === "group"
                    ? row.departureCount
                      ? `Next ${row.nextDeparture} · ${row.seatsLeft} seats · from ${money(row.price)}`
                      : "No open departures"
                    : row.price
                      ? `from ${money(row.price)}`
                      : "No price yet"}
                </span>
              </span>
              <ChevronIcon size={14} className="shrink-0 text-paper-text-faint" />
            </Link>
          );
        })}

        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-paper-line-strong p-6 text-center text-[13px] text-paper-text-muted">
            {rows.length === 0
              ? "No trips yet. Create one above — it starts as a draft."
              : "No trips match. Clear the search or pick another filter."}
          </p>
        )}
      </div>
    </div>
  );
}
