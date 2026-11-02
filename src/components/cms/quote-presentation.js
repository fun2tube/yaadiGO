"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMPLATES } from "@/lib/crm/quote-content";
import { getImage } from "@/lib/media";
import { pickValue } from "@/lib/media-rules";
import MediaPicker, { ImageField } from "@/components/cms/media-picker";
import { AlertIcon, CheckIcon, ImageIcon } from "@/components/icons";

/**
 * How the quotation looks, as opposed to what it costs.
 *
 * Kept separate from the pricing builder on purpose: they are two different
 * jobs done at two different moments. A salesperson prices the trip, then —
 * once the numbers are settled — decides how to present it.
 *
 * Nothing here can change a figure. The template only chooses which blocks
 * render and in what order.
 *
 * Every image slot opens the photo library (components/cms/media-picker.js)
 * — pick, or upload from the phone right there. Until 2026-10-14 each hotel
 * and flight took a pasted link, and highlights, stay and transport galleries
 * and the route map had no editor at all.
 */

const field =
  "w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent";
const label = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";

/** A row's { imageId, imageUrl } ↔ the picker's { id, url }. */
const asField = (row, idKey = "imageId", urlKey = "imageUrl") =>
  row?.[idKey] || row?.[urlKey] ? { id: row[idKey] ?? null, url: row[urlKey] ?? null, alt: row.imageAlt ?? "" } : null;
const fromField = (value, idKey = "imageId", urlKey = "imageUrl") => ({
  [idKey]: value?.id ?? null,
  [urlKey]: value?.url ?? null,
  ...(idKey === "imageId" ? { imageAlt: value?.alt ?? null } : {}),
});

function Section({ title, hint, children, action }) {
  return (
    <section className="mt-5 border-t border-paper-line pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={label}>{title}</p>
          {hint ? <p className="mt-0.5 text-[12px] text-paper-text-faint">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** Repeatable rows — hotels, flights, highlights — each with a photo slot. */
function Rows({ rows, onChange, fields, imageCategory, imageLabel }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-paper-line-strong px-3 py-3 text-[12.5px] text-paper-text-faint">
          None yet.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-paper-line bg-paper-dim p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className={`flex flex-col gap-1 ${f.wide ? "sm:col-span-2" : ""}`}>
                <span className={label}>{f.label}</span>
                <input
                  value={row[f.key] ?? ""}
                  onChange={(e) => onChange(rows.map((r, x) => (x === i ? { ...r, [f.key]: e.target.value } : r)))}
                  placeholder={f.placeholder}
                  className={field}
                />
              </label>
            ))}
          </div>
          <div className="mt-2.5">
            <ImageField
              value={asField(row)}
              onChange={(v) => onChange(rows.map((r, x) => (x === i ? { ...r, ...fromField(v) } : r)))}
              category={imageCategory}
              label={imageLabel}
            />
          </div>
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
  );
}

/** A photo strip: stay photos, transport photos. Pick many at once. */
function Gallery({ images, onChange, category }) {
  const [open, setOpen] = useState(false);
  const list = images ?? [];
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {list.map((image, i) => {
          const src = image.url || (image.id ? getImage(image.id)?.src : null);
          return (
            <div key={`${image.id ?? image.url}-${i}`} className="relative overflow-hidden rounded-lg border border-paper-line">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={image.alt ?? ""} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="aspect-[4/3] w-full bg-paper-dim" />
              )}
              <button
                type="button"
                onClick={() => onChange(list.filter((_, x) => x !== i))}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-bold text-white"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-paper-line-strong text-[12px] font-bold text-accent-deep"
        >
          <ImageIcon size={18} /> Add photos
        </button>
      </div>
      <MediaPicker
        open={open}
        multiple
        onClose={() => setOpen(false)}
        defaultCategory={category}
        title="Add photos"
        onPick={(items) => {
          const added = items.map((item) => {
            const v = pickValue(item);
            return { id: v.id, url: v.url, alt: v.alt };
          });
          onChange([...list, ...added]);
        }}
      />
    </>
  );
}

export default function QuotePresentation({ quotation, initialContent }) {
  const [content, setContent] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const set = (patch) => {
    setSaved(null);
    setContent((prev) => ({ ...prev, ...patch }));
  };
  const detailed = content.template !== "simple";

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
        return false;
      }
      setSaved("Saved.");
      router.refresh();
      return true;
    } catch {
      setError("Couldn't reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-4">
      <h2 className="text-[14px] font-bold text-paper-text">How it looks</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
        Choosing a template changes which sections appear — never a figure. Photos come from the
        library; upload new ones from any photo slot.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
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

      {detailed && (
        <Section title="Cover photo" hint="The big picture at the top — the destination, not a hotel lobby.">
          <ImageField
            value={asField(content, "heroImageId", "heroImageUrl")}
            onChange={(v) => set(fromField(v, "heroImageId", "heroImageUrl"))}
            category="destination"
            label="Cover photo"
          />
        </Section>
      )}

      <Section
        title="What you will see — activities & sightseeing"
        hint="The block customers read first and forward. A photo and one honest line each."
        action={
          <button
            type="button"
            onClick={() => set({ highlights: [...(content.highlights ?? []), {}] })}
            className="shrink-0 text-[12px] font-bold text-accent-deep"
          >
            + Add
          </button>
        }
      >
        <Rows
          rows={content.highlights ?? []}
          onChange={(highlights) => set({ highlights })}
          imageCategory="activity"
          imageLabel="Activity photo"
          fields={[
            { key: "title", label: "Attraction / activity", placeholder: "Gulmarg Gondola" },
            { key: "note", label: "When", placeholder: "Day 3 · morning" },
            { key: "detail", label: "One line", placeholder: "Asia’s highest cable car, to 3,980 m.", wide: true },
          ]}
        />
      </Section>

      <Section
        title="Hotels"
        action={
          <button
            type="button"
            onClick={() => set({ hotels: [...(content.hotels ?? []), {}] })}
            className="shrink-0 text-[12px] font-bold text-accent-deep"
          >
            + Add hotel
          </button>
        }
      >
        <Rows
          rows={content.hotels ?? []}
          onChange={(hotels) => set({ hotels })}
          imageCategory="hotel"
          imageLabel="Hotel photo"
          fields={[
            { key: "name", label: "Name", placeholder: "Taj Malabar" },
            { key: "city", label: "City", placeholder: "Kochi" },
            { key: "nights", label: "Nights", placeholder: "2" },
            { key: "roomType", label: "Room", placeholder: "Deluxe, double" },
          ]}
        />
      </Section>

      {detailed && (
        <Section
          title="Flights"
          action={
            <button
              type="button"
              onClick={() => set({ flights: [...(content.flights ?? []), {}] })}
              className="shrink-0 text-[12px] font-bold text-accent-deep"
            >
              + Add flight
            </button>
          }
        >
          <Rows
            rows={content.flights ?? []}
            onChange={(flights) => set({ flights })}
            imageCategory="flight"
            imageLabel="Airline photo"
            fields={[
              { key: "route", label: "Route", placeholder: "Delhi → Kochi" },
              { key: "airline", label: "Airline", placeholder: "IndiGo 6E-2143" },
              { key: "date", label: "Date", placeholder: "12 Feb" },
              { key: "time", label: "Time", placeholder: "06:15 → 09:05" },
            ]}
          />
        </Section>
      )}

      {detailed && (
        <>
          <Section title="Where you stay — photo gallery" hint="Rooms, the view, the pool. Detailed template only.">
            <Gallery images={content.stayPhotos} onChange={(stayPhotos) => set({ stayPhotos })} category="hotel" />
          </Section>

          <Section title="How you travel — photo gallery" hint="The car, the tempo traveller, the houseboat.">
            <Gallery
              images={content.transportPhotos}
              onChange={(transportPhotos) => set({ transportPhotos })}
              category="transport"
            />
          </Section>

          <Section title="Route map">
            <ImageField
              value={asField(content, "routeMapId", "routeMapUrl")}
              onChange={(v) => set(fromField(v, "routeMapId", "routeMapUrl"))}
              category="map"
              label="Route map"
            />
          </Section>
        </>
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save presentation"}
        </button>
        {/* Staff preview, for drafts too. It used to open the customer link,
            which 404s until the quotation is sent (2026-10-14). Saving first
            means the preview shows what was just edited. */}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            // Opened inside the click, before the await — a window opened
            // after it is treated as a popup and blocked.
            const tab = window.open("about:blank", "_blank");
            if (tab) tab.opener = null;
            const ok = await save();
            const url = `/admin/quotations/${quotation.id}/preview`;
            if (!ok) tab?.close();
            else if (tab) tab.location.href = url;
            else router.push(url);
          }}
          className="flex-1 rounded-xl border border-paper-line-strong px-4 py-3 text-[14px] font-bold text-paper-text disabled:opacity-40"
        >
          Save &amp; preview what the customer sees ↗
        </button>
      </div>
    </div>
  );
}
