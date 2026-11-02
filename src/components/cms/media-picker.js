"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MEDIA_CATEGORIES, pickValue } from "@/lib/media-rules";
import { getImage } from "@/lib/media";
import { uploadPhoto } from "@/lib/media-upload-client";
import { AlertIcon, CheckIcon, ImageIcon, UploadIcon } from "@/components/icons";

/**
 * Choose photos from the library — or upload new ones without leaving the
 * quotation.
 *
 * Replaces "Image — paste a link". A salesperson pricing a Kerala trip opens
 * this on the hotel row, taps "Hotels & stays", searches "alleppey", and picks
 * the houseboat photo uploaded last month; if it is not there, they upload it
 * from their phone right here and it is in the library for next time.
 *
 * `onPick` receives an array of library items (one unless `multiple`).
 */

const CHIP =
  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors";

export function useMediaLibrary(open, { category, query }) {
  const [items, setItems] = useState([]);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ category: category || "all", q: query || "" });
        const response = await fetch(`/api/admin/media?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Could not load the library.");
        setItems(data.items ?? []);
        setStorage(data.storage ?? null);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, category, query, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { items, storage, loading, error, reload };
}

export default function MediaPicker({ open, onClose, onPick, multiple = false, defaultCategory = "all", title = "Choose a photo" }) {
  const [category, setCategory] = useState(defaultCategory);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [uploads, setUploads] = useState([]);
  const fileInput = useRef(null);
  const { items, storage, loading, error, reload } = useMediaLibrary(open, { category, query });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isSelected = (item) => selected.some((s) => s.id === item.id);

  function toggle(item) {
    if (!multiple) {
      onPick([item]);
      onClose();
      return;
    }
    setSelected((prev) => (isSelected(item) ? prev.filter((s) => s.id !== item.id) : [...prev, item]));
  }

  async function upload(files) {
    const list = [...files];
    const uploadCategory = category === "all" ? "other" : category;
    setUploads(list.map((f) => ({ name: f.name, state: "uploading" })));
    const done = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const item = await uploadPhoto(list[i], { category: uploadCategory });
        done.push(item);
        setUploads((prev) => prev.map((u, x) => (x === i ? { ...u, state: "done" } : u)));
      } catch (err) {
        setUploads((prev) => prev.map((u, x) => (x === i ? { ...u, state: "error", message: err.message } : u)));
      }
    }
    reload();
    if (done.length > 0) {
      if (multiple) setSelected((prev) => [...prev, ...done]);
      else {
        onPick([done[0]]);
        onClose();
      }
    }
  }

  const uploading = uploads.some((u) => u.state === "uploading");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />

      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-paper-line px-4 py-3">
          <h2 className="text-[15px] font-bold text-paper-text">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-paper-text-muted">
            Close
          </button>
        </header>

        <div className="flex flex-col gap-2.5 border-b border-paper-line px-4 py-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — hotel name, city, ‘houseboat’, ‘gondola’…"
              className="min-w-0 flex-1 rounded-xl border border-paper-line-strong bg-card px-3 py-2.5 text-[13.5px] outline-none focus:border-accent"
              autoFocus
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || storage?.kind === "none"}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2.5 text-[13px] font-bold text-ink-text disabled:opacity-40"
            >
              <UploadIcon size={15} /> Upload
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) upload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {[{ value: "all", label: "All" }, ...MEDIA_CATEGORIES].map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`${CHIP} ${
                  category === c.value ? "border-ink bg-ink text-ink-text" : "border-paper-line-strong text-paper-text-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {category !== "all" && (
            <p className="text-[11.5px] text-paper-text-faint">
              New uploads go into “{MEDIA_CATEGORIES.find((c) => c.value === category)?.label}”.
            </p>
          )}
          {storage?.kind === "none" && (
            <p className="flex items-start gap-1.5 text-[12px] text-warn">
              <AlertIcon size={13} className="mt-0.5 shrink-0" /> {storage.label}
            </p>
          )}
          {uploads.length > 0 && (
            <ul className="flex flex-col gap-1">
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
                    {u.state === "uploading" ? " — shrinking and uploading…" : ""}
                    {u.state === "error" ? ` — ${u.message}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-h-[240px] flex-1 overflow-y-auto px-4 py-3">
          {error ? (
            <p className="flex items-center gap-1.5 text-[13px] text-danger">
              <AlertIcon size={13} /> {error}
            </p>
          ) : loading && items.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-paper-text-faint">Loading the library…</p>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <ImageIcon size={28} className="mx-auto text-paper-text-faint" />
              <p className="mt-2 text-[13px] text-paper-text-muted">
                {query ? "Nothing matches that search." : "No photos in this category yet."}
              </p>
              <p className="mt-1 text-[12px] text-paper-text-faint">Upload one from your phone or computer.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item)}
                  title={item.title}
                  aria-pressed={multiple ? isSelected(item) : undefined}
                  className={`group relative overflow-hidden rounded-xl border-2 text-left transition-all ${
                    isSelected(item) ? "border-accent ring-2 ring-accent/30" : "border-transparent hover:border-accent/50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.alt ?? ""} loading="lazy" className="aspect-[4/3] w-full bg-paper-dim object-cover" />
                  <span className="block truncate px-1.5 py-1 text-[11px] font-semibold text-paper-text">
                    {item.title}
                  </span>
                  {item.builtin && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                      WEBSITE
                    </span>
                  )}
                  {isSelected(item) && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <CheckIcon size={13} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {multiple && (
          <footer className="flex items-center justify-between gap-3 border-t border-paper-line px-4 py-3">
            <span className="text-[12.5px] text-paper-text-muted">{selected.length} selected</span>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => {
                onPick(selected);
                setSelected([]);
                onClose();
              }}
              className="rounded-xl bg-accent px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
            >
              Add {selected.length || ""} photo{selected.length === 1 ? "" : "s"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

/**
 * One image slot: thumbnail, Choose / Change, Remove, and "paste a link"
 * kept for the odd photo a hotel only sent as a URL.
 *
 * `value` is { id?, url?, alt? } — a built-in photo by id, anything else by
 * URL (lib/media-rules.js pickValue).
 */
export function ImageField({ value, onChange, category = "all", label = "Photo" }) {
  const [open, setOpen] = useState(false);
  const [pasting, setPasting] = useState(false);
  const src = value?.url || (value?.id ? getImage(value.id)?.src : null);

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-paper-line bg-paper-dim">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={value?.alt ?? ""} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-paper-text-faint" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={() => setOpen(true)} className="text-[12.5px] font-bold text-accent-deep">
            {src ? "Change photo" : `Choose ${label.toLowerCase()}`}
          </button>
          {src && (
            <button type="button" onClick={() => onChange(null)} className="text-[12px] font-semibold text-paper-text-faint hover:text-danger">
              Remove
            </button>
          )}
          <button type="button" onClick={() => setPasting((p) => !p)} className="text-[11.5px] text-paper-text-faint underline-offset-2 hover:underline">
            {pasting ? "Hide link" : "or paste a link"}
          </button>
        </div>
      </div>
      {pasting && (
        <input
          value={value?.id ? "" : value?.url ?? ""}
          onChange={(e) => onChange(e.target.value.trim() ? { id: null, url: e.target.value.trim(), alt: value?.alt ?? "" } : null)}
          placeholder="https://…"
          className="mt-2 w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13px] outline-none focus:border-accent"
        />
      )}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        defaultCategory={category}
        title={`Choose ${label.toLowerCase()}`}
        onPick={([item]) => onChange(pickValue(item))}
      />
    </div>
  );
}
