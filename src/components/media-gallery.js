"use client";

import { useMemo, useState } from "react";
import NextImage from "next/image";
import { media, allTags, searchImages } from "@/lib/media";
import { CheckIcon, ChevronIcon } from "./icons";

/**
 * The media library browser.
 *
 * Its job is reuse: find an image you already have, see its alt text and
 * tags, and copy the one-line snippet that puts it on a page. Every field a
 * developer or editor needs is visible, including the licence, because
 * attribution-required images have to be credited wherever they are used.
 */

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => {}
        );
      }}
      className="flex items-center gap-1 rounded-lg border border-paper-line-strong px-2.5 py-1 font-mono text-[10.5px] text-paper-text-muted transition-colors hover:border-accent hover:text-accent-deep"
    >
      {copied ? (
        <>
          <CheckIcon size={11} /> Copied
        </>
      ) : (
        label
      )}
    </button>
  );
}

function MediaItem({ item }) {
  const [open, setOpen] = useState(false);
  const snippet = `<Img id="${item.id}" />`;

  return (
    <div className="overflow-hidden rounded-2xl border border-paper-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="block w-full text-left"
      >
        <span className="relative block aspect-[3/2] overflow-hidden bg-paper-dim">
          <NextImage
            src={item.src}
            alt={item.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </span>
      </button>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-paper-text">{item.title}</p>
            <p className="mt-0.5 font-mono text-[10px] text-paper-text-faint">{item.id}</p>
          </div>
          <CopyButton value={snippet} label="Copy tag" />
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-paper-dim px-1.5 py-0.5 font-mono text-[10px] text-paper-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex items-center gap-1 text-[11.5px] font-semibold text-accent-deep"
        >
          {open ? "Hide details" : "Details, alt text & licence"}
          <ChevronIcon size={11} className={open ? "rotate-90" : ""} />
        </button>

        {open && (
          <dl className="mt-3 flex flex-col gap-2.5 border-t border-paper-line pt-3">
            <div>
              <dt className="eyebrow text-paper-text-faint">Alt text</dt>
              <dd className="mt-1 text-[12.5px] leading-relaxed text-paper-text">{item.alt}</dd>
            </div>
            <div>
              <dt className="eyebrow text-paper-text-faint">Description</dt>
              <dd className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
                {item.description}
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-paper-text-faint">Dimensions</dt>
              <dd className="mt-1 font-mono text-[11.5px] text-paper-text-muted">
                {item.width} × {item.height}
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-paper-text-faint">Licence</dt>
              <dd className="mt-1 text-[12px] leading-relaxed text-paper-text-muted">
                <span className="font-semibold text-paper-text">{item.credit.licence}</span>
                {" — "}
                {item.credit.author}
                {item.credit.sourceUrl && (
                  <>
                    {" · "}
                    <a
                      href={item.credit.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-deep underline"
                    >
                      {item.credit.source}
                    </a>
                  </>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

export default function MediaGallery() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState(null);

  const tags = useMemo(() => allTags(), []);

  const results = useMemo(() => {
    let list = searchImages(query);
    if (tag) list = list.filter((item) => item.tags.includes(tag));
    return list;
  }, [query, tag]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, alt text, description or tag…"
          className="w-full rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[15px] text-paper-text outline-none focus:border-accent"
        />

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTag(null)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition-all ${
              tag === null
                ? "border-ink bg-ink text-ink-text"
                : "border-paper-line-strong text-paper-text-muted hover:border-ink/40"
            }`}
          >
            all {media.length}
          </button>
          {tags.map(({ tag: t, count }) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t === tag ? null : t)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[11px] transition-all ${
                tag === t
                  ? "border-accent bg-accent text-white"
                  : "border-paper-line-strong text-paper-text-muted hover:border-accent/50"
              }`}
            >
              {t} {count}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 font-mono text-[11px] text-paper-text-faint">
        {results.length} image{results.length === 1 ? "" : "s"}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-paper-line-strong p-10 text-center text-[14px] text-paper-text-muted">
          Nothing matches.{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTag(null);
            }}
            className="font-bold text-accent-deep underline"
          >
            Reset
          </button>
        </p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <MediaItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
