"use client";

import { useEffect, useRef, useState } from "react";
import { useEditMode, useSelectionOutline } from "./edit-mode";
import AgentChat from "./agent-chat";
import { STYLE_GROUPS } from "@/lib/cms/style-tokens";
import { media } from "@/lib/media";
import { CheckIcon, ChevronIcon, SparkleIcon, AlertIcon } from "@/components/icons";

/**
 * The inspector: what opens when an editor clicks an element.
 *
 * Three tabs, in the order people reach for them — the words, then how they
 * look, then asking for it in English. The manual tabs and the agent write
 * through the same API, so neither can do something the other cannot undo.
 */

const TABS = [
  { id: "content", label: "Content" },
  { id: "design", label: "Design" },
  { id: "ai", label: "Ask AI" },
];

export default function Inspector() {
  const { active, selected, setSelected, storage, pathname, refresh } = useEditMode();
  const [tab, setTab] = useState("content");
  const [field, setField] = useState(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const textRef = useRef(null);

  useSelectionOutline(selected?.id ?? null);

  const selectedId = selected?.id ?? null;

  // Reset the panel when a different element is picked. Done during render
  // rather than in an effect — React's pattern for "reset state on key
  // change" — so the panel never paints one frame of the previous element's
  // text under the new element's heading.
  const [loadedFor, setLoadedFor] = useState(null);
  if (loadedFor !== selectedId) {
    setLoadedFor(selectedId);
    setField(null);
    setStatus(null);
    setTab("content");
    setDraft(selected?.visibleText ?? "");
  }

  // Then fetch that element's saved overrides.
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;

    fetch(`/api/admin/content?id=${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setField(data.field);
        // Prefer a saved override; otherwise seed from what is actually on
        // the page, so editing always starts from the truth.
        if (data.field?.text) setDraft(data.field.text);
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: "error", message: "Couldn't load that element." });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (!active || !selected) return null;

  async function save(patch, successMessage = "Saved") {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, path: pathname, ...patch }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus({ kind: "error", message: data.message ?? "Couldn't save that." });
        return false;
      }
      setField(data.field);
      setStatus({ kind: "ok", message: successMessage });
      return true;
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function revert() {
    setBusy(true);
    await fetch(
      `/api/admin/content?id=${encodeURIComponent(selected.id)}&path=${encodeURIComponent(pathname)}`,
      { method: "DELETE" }
    );
    setBusy(false);
    refresh();
  }

  const style = field?.style ?? {};
  const edited = Boolean(field?.text || field?.style || field?.image || field?.hidden);

  return (
    <aside className="no-print fixed inset-x-0 bottom-0 z-[80] flex h-[70dvh] flex-col rounded-t-2xl border border-paper-line-strong bg-paper shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[400px] md:rounded-none md:border-l">
      <header className="flex items-start justify-between gap-3 border-b border-paper-line px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-deep">
            {selected.tag} · editing
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-paper-text-faint" title={selected.id}>
            {selected.id}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label="Close inspector"
          className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold text-paper-text-muted hover:bg-paper-dim"
        >
          Close
        </button>
      </header>

      <nav className="flex border-b border-paper-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 px-3 py-2.5 text-[12.5px] font-bold transition-colors ${
              tab === item.id
                ? "border-b-2 border-accent text-accent-deep"
                : "text-paper-text-faint hover:text-paper-text-muted"
            }`}
          >
            {item.id === "ai" ? (
              <span className="flex items-center justify-center gap-1.5">
                <SparkleIcon size={12} /> {item.label}
              </span>
            ) : (
              item.label
            )}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "content" && (
          <div className="flex flex-col gap-3 p-4">
            <label className="eyebrow text-paper-text-faint" htmlFor="cms-text">
              Text
            </label>
            <textarea
              id="cms-text"
              ref={textRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={selected.kind === "multiline" ? 10 : 4}
              className="w-full resize-y rounded-xl border border-paper-line-strong bg-card px-3.5 py-3 text-[14px] leading-relaxed text-paper-text outline-none focus:border-accent"
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-paper-text-faint">
                {draft.length} characters
              </span>
              <button
                type="button"
                disabled={busy || draft === (field?.text ?? selected.visibleText)}
                onClick={async () => {
                  if (await save({ text: draft })) refresh();
                }}
                className="rounded-xl bg-accent px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>

            <div className="mt-2 border-t border-paper-line pt-3">
              <button
                type="button"
                onClick={async () => {
                  if (await save({ hidden: !field?.hidden })) refresh();
                }}
                className="w-full rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-semibold text-paper-text-muted hover:border-accent"
              >
                {field?.hidden ? "Show this element" : "Hide this element"}
              </button>
              <p className="mt-2 text-[11.5px] leading-relaxed text-paper-text-faint">
                Hiding is reversible and removes nothing from the code.
              </p>
            </div>
          </div>
        )}

        {tab === "design" && (
          <div className="flex flex-col gap-5 p-4">
            {STYLE_GROUPS.map((group) => (
              <div key={group.key}>
                <span className="eyebrow text-paper-text-faint">{group.label}</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.options.map((option) => {
                    const on = style[group.key] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const next = { ...style };
                          if (on) delete next[group.key];
                          else next[group.key] = option.value;
                          if (await save({ style: Object.keys(next).length ? next : null })) refresh();
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-all ${
                          on
                            ? "border-accent bg-accent text-white"
                            : "border-paper-line-strong text-paper-text-muted hover:border-accent/50"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <p className="rounded-xl bg-paper-dim p-3 text-[11.5px] leading-relaxed text-paper-text-muted">
              These are the site&apos;s own design tokens, not free CSS. That keeps an edited page
              consistent with every page nobody has edited.
            </p>

            {selected.kind === "image" && (
              <div>
                <span className="eyebrow text-paper-text-faint">Image</span>
                <select
                  value={field?.image ?? ""}
                  disabled={busy}
                  onChange={async (e) => {
                    if (await save({ imageId: e.target.value || null })) refresh();
                  }}
                  className="mt-2 w-full rounded-xl border border-paper-line-strong bg-card px-3 py-2.5 text-[13px]"
                >
                  <option value="">Default</option>
                  {media.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {tab === "ai" && (
          <AgentChat
            elementId={selected.id}
            context={{ tag: selected.tag, visibleText: selected.visibleText }}
            path={pathname}
            onChanged={refresh}
          />
        )}
      </div>

      <footer className="border-t border-paper-line px-4 py-3">
        {status && (
          <p
            className={`mb-2 flex items-start gap-1.5 text-[12px] font-semibold ${
              status.kind === "ok" ? "text-good" : "text-danger"
            }`}
          >
            {status.kind === "ok" ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
            {status.message}
          </p>
        )}

        {!storage?.durable && (
          <p className="mb-2 rounded-lg border border-warn/40 bg-warn/10 p-2 text-[11px] leading-relaxed text-paper-text">
            {storage?.message}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10.5px] text-paper-text-faint">
            {edited ? "edited" : "original"}
          </span>
          {edited && (
            <button
              type="button"
              onClick={revert}
              disabled={busy}
              className="flex items-center gap-1 text-[12px] font-bold text-paper-text-muted hover:text-danger"
            >
              Revert to original <ChevronIcon size={11} />
            </button>
          )}
        </div>
      </footer>
    </aside>
  );
}
