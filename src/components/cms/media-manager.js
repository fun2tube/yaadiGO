"use client";

import { useRef, useState } from "react";
import { MEDIA_CATEGORIES } from "@/lib/media-rules";
import { uploadPhoto } from "@/lib/media-upload-client";
import { useMediaLibrary } from "@/components/cms/media-picker";
import { AlertIcon, CheckIcon, ImageIcon, UploadIcon } from "@/components/icons";

/**
 * The library screen: upload in batches, find, tidy.
 *
 * A batch shares its category, destination and tags — the realistic job is
 * "these twelve are the Alleppey houseboat", not twelve separate forms.
 */

const field =
  "w-full rounded-xl border border-paper-line-strong bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-accent";
const label = "block font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint";
const CHIP = "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold";

function Editor({ item, onSaved, onClose, canEdit }) {
  const [form, setForm] = useState({
    title: item.title ?? "",
    alt: item.alt ?? "",
    category: item.category ?? "other",
    tags: (item.tags ?? []).join(", "),
    destination: item.destination ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function patch(body) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Could not save.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const readOnly = item.builtin || !canEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Photo details">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-4 shadow-2xl sm:rounded-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.alt ?? ""} className="max-h-[40dvh] w-full rounded-xl bg-paper-dim object-contain" />
        <p className="mt-2 font-mono text-[10.5px] text-paper-text-faint">
          {item.builtin
            ? "Website photo — licensed and credited on /credits. Read-only."
            : `${item.width ?? "?"}×${item.height ?? "?"} · ${Math.round((item.bytes ?? 0) / 1024)} KB · added by ${item.uploadedByName ?? "—"}`}
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <label>
            <span className={label}>Title</span>
            <input disabled={readOnly} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${field} mt-1.5`} />
          </label>
          <label>
            <span className={label}>Describe it for someone who can’t see it (alt text)</span>
            <input disabled={readOnly} value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} className={`${field} mt-1.5`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={label}>Category</span>
              <select disabled={readOnly} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${field} mt-1.5`}>
                {MEDIA_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>Destination</span>
              <input disabled={readOnly} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Srinagar" className={`${field} mt-1.5`} />
            </label>
          </div>
          <label>
            <span className={label}>Tags, separated by commas</span>
            <input disabled={readOnly} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="houseboat, dal lake, deluxe" className={`${field} mt-1.5`} />
          </label>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-danger">
            <AlertIcon size={13} /> {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!readOnly && (
            <button type="button" disabled={busy} onClick={() => patch(form)} className="flex-1 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-bold text-ink-text disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ archived: !item.archived })}
              className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-semibold text-paper-text-muted disabled:opacity-50"
            >
              {item.archived ? "Restore to the library" : "Archive"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-semibold text-paper-text-muted">
            Close
          </button>
        </div>
        {!readOnly && !item.archived && (
          <p className="mt-2 text-[11.5px] text-paper-text-faint">
            Archiving hides it from the picker. Quotations already using it keep showing it.
          </p>
        )}
      </div>
    </div>
  );
}

export default function MediaManager({ canEdit, storage }) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [batch, setBatch] = useState({ category: "hotel", destination: "", tags: "" });
  const [uploads, setUploads] = useState([]);
  const [editing, setEditing] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);

  const { items, loading, error, reload } = useMediaLibrary(true, { category, query });
  const [archived, setArchived] = useState(null);

  async function loadArchived() {
    const response = await fetch(`/api/admin/media?uploads=1&archived=1&category=${category}`);
    const data = await response.json().catch(() => ({ items: [] }));
    setArchived((data.items ?? []).filter((i) => i.archived));
  }

  async function upload(fileList) {
    const files = [...fileList];
    if (files.length === 0) return;
    const start = uploads.length;
    setUploads((prev) => [...prev, ...files.map((f) => ({ name: f.name, state: "uploading" }))]);
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadPhoto(files[i], batch);
        setUploads((prev) => prev.map((u, x) => (x === start + i ? { ...u, state: "done" } : u)));
      } catch (err) {
        setUploads((prev) => prev.map((u, x) => (x === start + i ? { ...u, state: "error", message: err.message } : u)));
      }
    }
    reload();
  }

  const blocked = storage?.kind === "none";
  const shown = showArchived ? archived ?? [] : items;

  return (
    <div className="flex flex-col gap-5">
      {!storage?.durable && (
        <p className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${blocked ? "border-danger/30 bg-danger/10 text-danger" : "border-warn/40 bg-warn/10 text-paper-text"}`}>
          <AlertIcon size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong>Photos are stored on:</strong> {storage?.label}
          </span>
        </p>
      )}

      {canEdit && (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!blocked) upload(e.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${dragging ? "border-accent bg-accent/5" : "border-paper-line-strong bg-card"}`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className={label}>These photos are</span>
              <select value={batch.category} onChange={(e) => setBatch({ ...batch, category: e.target.value })} className={`${field} mt-1.5`}>
                {MEDIA_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>Destination</span>
              <input value={batch.destination} onChange={(e) => setBatch({ ...batch, destination: e.target.value })} placeholder="Alleppey" className={`${field} mt-1.5`} />
            </label>
            <label>
              <span className={label}>Tags (comma separated)</span>
              <input value={batch.tags} onChange={(e) => setBatch({ ...batch, tags: e.target.value })} placeholder="houseboat, deluxe" className={`${field} mt-1.5`} />
            </label>
          </div>
          <button
            type="button"
            disabled={blocked}
            onClick={() => fileInput.current?.click()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-[14px] font-bold text-ink-text disabled:opacity-40"
          >
            <UploadIcon size={16} /> Choose photos to upload
          </button>
          <p className="mt-1.5 text-center text-[11.5px] text-paper-text-faint">
            Or drop them here. JPEG, PNG or WebP — shrunk to 2000 px on your device before upload, and
            location data removed.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            hidden
            onChange={(e) => {
              upload(e.target.files ?? []);
              e.target.value = "";
            }}
          />
          {uploads.length > 0 && (
            <ul className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {uploads.map((u, i) => (
                <li key={`${u.name}-${i}`} className="flex items-start gap-1.5 text-[12px]">
                  {u.state === "done" ? (
                    <CheckIcon size={12} className="mt-0.5 shrink-0 text-good" />
                  ) : u.state === "error" ? (
                    <AlertIcon size={12} className="mt-0.5 shrink-0 text-danger" />
                  ) : (
                    <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
                  )}
                  <span className={u.state === "error" ? "text-danger" : "text-paper-text-muted"}>
                    {u.name}
                    {u.state === "uploading" ? " — uploading…" : ""}
                    {u.state === "error" ? ` — ${u.message}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <div className="flex flex-col gap-2.5">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, destination or tag…" className={field} />
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {[{ value: "all", label: "All" }, ...MEDIA_CATEGORIES].map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setCategory(c.value);
                  if (showArchived) setArchived(null);
                }}
                className={`${CHIP} ${category === c.value ? "border-ink bg-ink text-ink-text" : "border-paper-line-strong text-paper-text-muted"}`}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const next = !showArchived;
                setShowArchived(next);
                if (next) loadArchived();
              }}
              className={`${CHIP} ${showArchived ? "border-ink bg-ink text-ink-text" : "border-paper-line-strong text-paper-text-faint"}`}
            >
              Archived
            </button>
          </div>
        </div>

        <div className="mt-3">
          {error ? (
            <p className="flex items-center gap-1.5 text-[13px] text-danger">
              <AlertIcon size={13} /> {error}
            </p>
          ) : loading && shown.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-paper-text-faint">Loading…</p>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-paper-line-strong py-10 text-center">
              <ImageIcon size={28} className="mx-auto text-paper-text-faint" />
              <p className="mt-2 text-[13px] text-paper-text-muted">
                {showArchived ? "Nothing archived." : query ? "Nothing matches that search." : "No photos here yet — upload some above."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setEditing(item)}
                  className="group overflow-hidden rounded-xl border border-paper-line bg-card text-left hover:border-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.alt ?? ""} loading="lazy" className="aspect-[4/3] w-full bg-paper-dim object-cover" />
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[12.5px] font-semibold text-paper-text">{item.title}</p>
                    <p className="truncate font-mono text-[10px] text-paper-text-faint">
                      {item.builtin ? "Website photo" : MEDIA_CATEGORIES.find((c) => c.value === item.category)?.label}
                      {item.destination ? ` · ${item.destination}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {editing && (
        <Editor
          item={editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSaved={() => {
            reload();
            if (showArchived) loadArchived();
          }}
        />
      )}
    </div>
  );
}
