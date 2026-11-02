"use client";

import { useMemo, useState } from "react";
import { media, searchImages } from "@/lib/media";

/**
 * Pick a photo by looking at it.
 *
 * The first version of the Image block asked for an "Image ID (from the media
 * library)" — a text box that required knowing a slug like
 * `kashmir-valley-escape` before you could place a picture. That is a developer
 * field wearing a content field's clothes, and it was the most annoying thing
 * in the builder.
 *
 * The library is already browser-safe and already carries alt text, dimensions
 * and licence credit per image, so the picker can show real thumbnails and the
 * right alt text travels with the choice automatically.
 *
 * Rendered inside Puck's field panel, which is narrow — hence two columns and
 * small type. Search is on, because 36 images is past the point where scanning
 * a grid is faster than typing three letters.
 */
export default function ImageField({ value, onChange }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const list = query.trim() ? searchImages(query) : media;
    // Cap the grid: a 36-thumbnail wall in a 300px panel is worse than a
    // prompt to search.
    return list.slice(0, 24);
  }, [query]);

  const selected = media.find((image) => image.id === value) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {selected ? (
        <div className="flex items-center gap-2 rounded border border-black/10 p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- the Puck
              panel is admin-only and next/image inside a field renderer brings
              layout machinery that fights the panel's own sizing. */}
          <img
            src={selected.src}
            alt=""
            className="h-10 w-14 shrink-0 rounded object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-[11px] leading-tight opacity-70">
            {selected.title ?? selected.id}
          </span>
        </div>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search photos — kerala, beach, hotel…"
        className="w-full rounded border border-black/15 px-2 py-1.5 text-[12px]"
      />

      <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto">
        {results.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => onChange(image.id)}
            title={image.title ?? image.id}
            className={`relative overflow-hidden rounded border-2 transition-colors ${
              image.id === value ? "border-blue-500" : "border-transparent hover:border-black/20"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt="" className="h-14 w-full object-cover" />
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="text-[11px] opacity-60">
          Nothing matches that. Photos are added in <code>src/lib/media.js</code>.
        </p>
      ) : null}
    </div>
  );
}
