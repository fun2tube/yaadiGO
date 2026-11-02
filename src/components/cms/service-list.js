"use client";

import { useState } from "react";
import { SERVICE_KINDS, SERVICE_STATUSES, TONE_CLASSES, money } from "@/lib/crm/schema";
import { AlertIcon, CheckIcon, PlaneIcon, HotelIcon, CarIcon, CalendarIcon } from "@/components/icons";

/**
 * The service list — what a trip is actually made of.
 *
 * Built against docs/design/operations.md. The decision that shapes it:
 * adding a service is ONE TAP plus a name. Ops writes "Hotel in Munnar" days
 * before they know which hotel, and a form demanding supplier and reference up
 * front is a form they will abandon for WhatsApp.
 */

const ICONS = { flight: PlaneIcon, hotel: HotelIcon, cab: CarIcon, train: CarIcon };

const field =
  "w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent";
const label = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";

function when(service) {
  if (!service.startsAt) return null;
  const d = new Date(service.startsAt);
  if (Number.isNaN(d.getTime())) return service.startsAt;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ServiceRow({ service, onPatch, onRemove, busy, canEdit }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(service);

  const meta = SERVICE_STATUSES.find((s) => s.value === service.status) ?? SERVICE_STATUSES[0];
  const kind = SERVICE_KINDS.find((k) => k.value === service.kind) ?? SERVICE_KINDS[0];
  const Icon = ICONS[service.kind] ?? CalendarIcon;

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <div className="overflow-hidden rounded-xl border border-paper-line bg-card">
      <button
        type="button"
        onClick={() => canEdit && setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
      >
        <span className="mt-0.5 shrink-0 text-paper-text-muted">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-paper-text">{service.title}</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${TONE_CLASSES[meta.tone]}`}
            >
              {meta.label}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] text-paper-text-faint">
            <span>{kind.label}</span>
            {service.supplier && <span>· {service.supplier}</span>}
            {service.reference && <span>· {service.reference}</span>}
            {when(service) && <span>· {when(service)}</span>}
          </span>
        </span>
      </button>

      {/* Status is one tap from the collapsed row — it is the thing that
          changes most and should not need the editor opened. */}
      {canEdit && (
        <div className="flex flex-wrap gap-1.5 border-t border-paper-line px-3.5 py-2">
          {SERVICE_STATUSES.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={busy || option.value === service.status}
              onClick={() => onPatch(service.id, { status: option.value })}
              className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-bold transition-all disabled:opacity-100 ${
                option.value === service.status
                  ? TONE_CLASSES[option.tone]
                  : "border border-paper-line-strong text-paper-text-muted hover:border-accent"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {open && canEdit && (
        <div className="border-t border-paper-line px-3.5 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={label}>Name</span>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={field} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Supplier</span>
              <input
                value={form.supplier ?? ""}
                onChange={(e) => set({ supplier: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>{kind.refLabel}</span>
              <input
                value={form.reference ?? ""}
                onChange={(e) => set({ reference: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Date</span>
              <input
                type="date"
                value={form.startsAt ?? ""}
                onChange={(e) => set({ startsAt: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Cost ₹</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.cost ?? 0}
                onChange={(e) => set({ cost: Number(e.target.value) || 0 })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Note</span>
              <input value={form.note ?? ""} onChange={(e) => set({ note: e.target.value })} className={field} />
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onPatch(service.id, {
                  title: form.title,
                  supplier: form.supplier || null,
                  reference: form.reference || null,
                  startsAt: form.startsAt || null,
                  cost: Number(form.cost) || 0,
                  note: form.note || null,
                });
                setOpen(false);
              }}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRemove(service.id)}
              className="rounded-xl border border-danger/40 px-3.5 py-2.5 text-[12.5px] font-semibold text-danger disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServiceList({ bookingId, initialServices, canEdit }) {
  const [services, setServices] = useState(initialServices ?? []);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ kind: "hotel", title: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const live = services.filter((s) => s.status !== "cancelled");
  const confirmed = live.filter((s) => s.status === "confirmed").length;

  async function patch(id, body) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      setServices((prev) => prev.map((s) => (s.id === id ? data.service : s)));
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!draft.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, ...draft }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      setServices((prev) => [...prev, data.service]);
      setDraft({ kind: draft.kind, title: "" });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    setBusy(true);
    await fetch(`/api/admin/operations?id=${id}`, { method: "DELETE" }).catch(() => {});
    setServices((prev) => prev.filter((s) => s.id !== id));
    setBusy(false);
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          What has to be arranged
        </h2>
        {live.length > 0 && (
          <span className="font-mono text-[11px] text-paper-text-muted">
            {/* Confirmed only. A requested hotel is not a booked hotel. */}
            {confirmed} of {live.length} confirmed
          </span>
        )}
      </div>

      {live.length > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-dim">
          <div
            className="h-full bg-good transition-all"
            style={{ width: `${Math.round((confirmed / live.length) * 100)}%` }}
          />
        </div>
      )}

      {services.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-paper-line-strong p-8 text-center text-[13px] leading-relaxed text-paper-text-muted">
          Nothing listed yet. Add the flights, hotels and cabs this trip needs —
          a name is enough to start, details can follow.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              onPatch={patch}
              onRemove={remove}
              busy={busy}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
          <AlertIcon size={13} /> {error}
        </p>
      )}

      {canEdit &&
        (adding ? (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
            <div className="flex gap-2">
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                className={`${field} w-[132px] shrink-0`}
              >
                {SERVICE_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="Hotel in Munnar"
                autoFocus
                className={field}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={add}
                disabled={busy || !draft.title.trim()}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
              >
                {busy ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[12.5px] font-semibold text-paper-text-muted"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 w-full rounded-xl border border-dashed border-paper-line-strong px-4 py-3 text-[13.5px] font-bold text-accent-deep hover:border-accent"
          >
            + Add a service
          </button>
        ))}

      {live.length > 0 && confirmed === live.length && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-good">
          <CheckIcon size={13} /> Everything is confirmed.
        </p>
      )}
    </section>
  );
}
