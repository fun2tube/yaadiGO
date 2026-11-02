"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/crm/quote-content";
import { allTags, searchImages } from "@/lib/media";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * How the quotation looks, as opposed to what it costs.
 *
 * Kept separate from the pricing builder on purpose: they are two different
 * jobs done at two different moments. A salesperson prices the trip, then —
 * once the numbers are settled — decides how to present it.
 *
 * Nothing here can change a figure. The template only chooses which blocks
 * render and in what order.
 */

const field =
  "w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent";
const label = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";

/** Pick from the media library — 36 images that already carry alt text and a licence. */
function ImagePicker({ value, onPick, query, onQuery }) {
  const results = query?.trim() ? searchImages(query).slice(0, 12) : [];

  return (
    <div>
      <input
        value={query ?? ""}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search the library — kerala, desert, beach…"
        className={field}
      />
      {results.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {results.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => onPick(image.id)}
              title={image.title}
              className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                value === image.id ? "border-accent" : "border-transparent hover:border-accent/50"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {query?.trim() && results.length === 0 && (
        <p className="mt-2 text-[12px] text-paper-text-muted">
          Nothing matches. Try a destination or a theme — {allTags().slice(0, 4).join(", ")}.
        </p>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="mt-2 text-[12px] font-semibold text-paper-text-faint hover:text-danger"
        >
          Remove image
        </button>
      )}
    </div>
  );
}

/** Repeatable rows — hotels and flights. */
function Rows({ title, rows, onChange, fields, addLabel }) {
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between">
        <p className={label}>{title}</p>
        <button
          type="button"
          onClick={() => onChange([...rows, {}])}
          className="text-[12px] font-bold text-accent-deep"
        >
          {addLabel}
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-paper-line bg-paper-dim p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className={label}>{f.label}</span>
                  <input
                    value={row[f.key] ?? ""}
                    onChange={(e) =>
                      onChange(rows.map((r, x) => (x === i ? { ...r, [f.key]: e.target.value } : r)))
                    }
                    placeholder={f.placeholder}
                    className={field}
                  />
                </label>
              ))}
            </div>
            {/* No file upload: there is no object storage yet. Saying "paste a
                link" is honest; a disabled upload button is not. */}
            <label className="mt-2 flex flex-col gap-1">
              <span className={label}>Image — paste a link</span>
              <input
                value={row.imageUrl ?? ""}
                onChange={(e) =>
                  onChange(rows.map((r, x) => (x === i ? { ...r, imageUrl: e.target.value } : r)))
                }
                placeholder="https://…"
                className={field}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, x) => x !== i))}
              className="mt-2 text-[12px] font-semibold text-paper-text-faint hover:text-danger"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function QuotePresentation({ quotation, initialContent }) {
  const [content, setContent] = useState(initialContent);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const set = (patch) => setContent((prev) => ({ ...prev, ...patch }));

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch("/api/admin/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quotation.id, action: "presentation", content }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      setSaved("Saved.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-4">
      <h2 className="text-[14px] font-bold text-paper-text">How it looks</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
        Choosing a template changes which sections appear — never a figure.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => set({ template: t.value })}
            className={`rounded-xl border px-3.5 py-3 text-left transition-all ${
              content.template === t.value
                ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                : "border-paper-line-strong hover:border-accent/50"
            }`}
          >
            <p className="text-[13.5px] font-bold text-paper-text">{t.label}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-paper-text-muted">{t.blurb}</p>
          </button>
        ))}
      </div>

      <label className="mt-4 flex flex-col gap-1">
        <span className={label}>Overview — the first thing they read</span>
        <textarea
          value={content.overview ?? ""}
          onChange={(e) => set({ overview: e.target.value })}
          rows={3}
          className={`${field} resize-y`}
        />
      </label>

      {content.template !== "simple" && (
        <div className="mt-4">
          <p className={label}>Hero image</p>
          <div className="mt-1.5">
            <ImagePicker
              value={content.heroImageId}
              onPick={(id) => set({ heroImageId: id })}
              query={query}
              onQuery={setQuery}
            />
          </div>
        </div>
      )}

      <Rows
        title="Hotels"
        rows={content.hotels ?? []}
        onChange={(hotels) => set({ hotels })}
        addLabel="+ Add hotel"
        fields={[
          { key: "name", label: "Name", placeholder: "Taj Malabar" },
          { key: "city", label: "City", placeholder: "Kochi" },
          { key: "nights", label: "Nights", placeholder: "2" },
          { key: "roomType", label: "Room", placeholder: "Deluxe, double" },
        ]}
      />

      {content.template !== "simple" && (
        <Rows
          title="Flights"
          rows={content.flights ?? []}
          onChange={(flights) => set({ flights })}
          addLabel="+ Add flight"
          fields={[
            { key: "route", label: "Route", placeholder: "Delhi → Kochi" },
            { key: "airline", label: "Airline", placeholder: "IndiGo 6E-2143" },
            { key: "date", label: "Date", placeholder: "12 Feb" },
            { key: "time", label: "Time", placeholder: "06:15 → 09:05" },
          ]}
        />
      )}

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
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save presentation"}
      </button>

      <a
        href={`/q/${quotation.token}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-center text-[12.5px] font-bold text-accent-deep"
      >
        Preview what the customer sees →
      </a>
    </div>
  );
}
