"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { CheckIcon, AlertIcon } from "@/components/icons";

/**
 * Edit the site menu — rename, reorder, add, remove.
 *
 * `Reorder` from `motion` rather than HTML5 drag-and-drop: the native API is
 * mouse-only in practice, and this is a travel desk that works on phones. This
 * one handles touch properly and animates the displacement, so you can see
 * where an item will land.
 *
 * Dragging is from a handle, not the whole row. Dragging the row would fight
 * the text inputs inside it — you could not place a cursor without starting a
 * drag.
 */

function Row({ item, onChange, onRemove }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-xl border border-paper-line bg-card p-2.5"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(event) => controls.start(event)}
        // touch-none stops the browser scrolling the page instead of dragging
        // the row — without it, reordering is impossible on a phone.
        className="shrink-0 cursor-grab touch-none px-1.5 text-paper-text-faint active:cursor-grabbing"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <g fill="currentColor">
            <circle cx="5" cy="3" r="1.2" /> <circle cx="9" cy="3" r="1.2" />
            <circle cx="5" cy="7" r="1.2" /> <circle cx="9" cy="7" r="1.2" />
            <circle cx="5" cy="11" r="1.2" /> <circle cx="9" cy="11" r="1.2" />
          </g>
        </svg>
      </button>

      <input
        value={item.label}
        onChange={(event) => onChange({ ...item, label: event.target.value })}
        placeholder="Label"
        className="w-28 shrink-0 rounded-lg border border-paper-line-strong bg-paper px-2 py-1.5 text-[13px] font-semibold text-paper-text"
      />
      <input
        value={item.href}
        onChange={(event) => onChange({ ...item, href: event.target.value })}
        placeholder="/link"
        className="min-w-0 flex-1 rounded-lg border border-paper-line-strong bg-paper px-2 py-1.5 font-mono text-[12px] text-paper-text-muted"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.label}`}
        className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-bold text-danger"
      >
        ✕
      </button>
    </Reorder.Item>
  );
}

export default function MenuEditor({ initialLinks, initialExtra, initialFooter, edited }) {
  const [links, setLinks] = useState(initialLinks);
  const [extra, setExtra] = useState(initialExtra);
  const [footer, setFooter] = useState(initialFooter ?? []);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send(action) {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reset" ? { action } : { action, links, mobileExtra: extra, footer }
        ),
      });
      const body = await response.json();
      if (!response.ok) {
        setStatus({ kind: "error", message: body.message ?? "Couldn't save that." });
        return;
      }
      if (action === "reset") {
        setLinks(body.links);
        setExtra(body.mobileExtra);
        setFooter(body.footer ?? []);
      }
      setStatus({
        kind: "ok",
        message: action === "reset" ? "Back to the menu in the code." : "Menu saved — it is live.",
      });
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const add = (setter, list) =>
    setter([...list, { href: "/", label: "New item", id: `n${Date.now()}` }]);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="text-[13px] font-bold text-paper-text">Main menu</h2>
        <p className="mt-0.5 text-[12px] text-paper-text-muted">
          Shown on every page, on phones and desktop. Drag the handle to reorder.
        </p>
        <Reorder.Group axis="y" values={links} onReorder={setLinks} className="mt-2.5 flex flex-col gap-2">
          {links.map((item, i) => (
            <Row
              key={item.href + i}
              item={item}
              onChange={(next) => setLinks(links.map((l, j) => (j === i ? next : l)))}
              onRemove={() => setLinks(links.filter((_, j) => j !== i))}
            />
          ))}
        </Reorder.Group>
        <button
          type="button"
          onClick={() => add(setLinks, links)}
          className="mt-2 rounded-lg border border-dashed border-paper-line-strong px-3 py-2 text-[12.5px] font-semibold text-paper-text-muted"
        >
          + Add a menu item
        </button>
      </section>

      <section>
        <h2 className="text-[13px] font-bold text-paper-text">Phone menu extras</h2>
        <p className="mt-0.5 text-[12px] text-paper-text-muted">
          Shown below the main items when the menu is opened on a phone.
        </p>
        <Reorder.Group axis="y" values={extra} onReorder={setExtra} className="mt-2.5 flex flex-col gap-2">
          {extra.map((item, i) => (
            <Row
              key={item.href + i}
              item={item}
              onChange={(next) => setExtra(extra.map((l, j) => (j === i ? next : l)))}
              onRemove={() => setExtra(extra.filter((_, j) => j !== i))}
            />
          ))}
        </Reorder.Group>
        <button
          type="button"
          onClick={() => add(setExtra, extra)}
          className="mt-2 rounded-lg border border-dashed border-paper-line-strong px-3 py-2 text-[12.5px] font-semibold text-paper-text-muted"
        >
          + Add a phone-only item
        </button>
      </section>

      <section>
        <h2 className="text-[13px] font-bold text-paper-text">Footer columns</h2>
        <p className="mt-0.5 text-[12px] text-paper-text-muted">
          The link columns at the bottom of every page. Drag to reorder within a
          column.
        </p>

        <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
          {footer.map((column, ci) => (
            <div key={ci} className="rounded-xl border border-paper-line bg-paper-dim p-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={column.title}
                  onChange={(event) =>
                    setFooter(
                      footer.map((c, j) =>
                        j === ci ? { ...c, title: event.target.value } : c
                      )
                    )
                  }
                  placeholder="Column title"
                  className="min-w-0 flex-1 rounded-lg border border-paper-line-strong bg-paper px-2 py-1.5 text-[12.5px] font-bold text-paper-text"
                />
                <button
                  type="button"
                  onClick={() => setFooter(footer.filter((_, j) => j !== ci))}
                  aria-label={`Remove the ${column.title} column`}
                  className="shrink-0 px-1.5 text-[12px] font-bold text-danger"
                >
                  ✕
                </button>
              </div>

              <Reorder.Group
                axis="y"
                values={column.links}
                onReorder={(next) =>
                  setFooter(footer.map((c, j) => (j === ci ? { ...c, links: next } : c)))
                }
                className="mt-2 flex flex-col gap-1.5"
              >
                {column.links.map((item, li) => (
                  <Row
                    key={item.href + li}
                    item={item}
                    onChange={(next) =>
                      setFooter(
                        footer.map((c, j) =>
                          j === ci
                            ? { ...c, links: c.links.map((l, k) => (k === li ? next : l)) }
                            : c
                        )
                      )
                    }
                    onRemove={() =>
                      setFooter(
                        footer.map((c, j) =>
                          j === ci ? { ...c, links: c.links.filter((_, k) => k !== li) } : c
                        )
                      )
                    }
                  />
                ))}
              </Reorder.Group>

              <button
                type="button"
                onClick={() =>
                  setFooter(
                    footer.map((c, j) =>
                      j === ci
                        ? { ...c, links: [...c.links, { href: "/", label: "New link" }] }
                        : c
                    )
                  )
                }
                className="mt-1.5 w-full rounded-lg border border-dashed border-paper-line-strong py-1.5 text-[11.5px] font-semibold text-paper-text-muted"
              >
                + Link
              </button>
            </div>
          ))}
        </div>

        {footer.length < 5 ? (
          <button
            type="button"
            onClick={() => setFooter([...footer, { title: "New column", links: [] }])}
            className="mt-2 rounded-lg border border-dashed border-paper-line-strong px-3 py-2 text-[12.5px] font-semibold text-paper-text-muted"
          >
            + Add a column
          </button>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2.5 border-t border-paper-line pt-4">
        <button
          type="button"
          onClick={() => send("save")}
          disabled={busy || links.length === 0}
          className="rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save menu"}
        </button>
        {edited ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Go back to the menu in the code?")) send("reset");
            }}
            disabled={busy}
            className="rounded-full border border-paper-line-strong px-5 py-2.5 text-[13.5px] font-bold text-paper-text"
          >
            Back to the coded menu
          </button>
        ) : null}
        {status ? (
          <span
            className={`flex items-center gap-1.5 text-[12.5px] font-semibold ${
              status.kind === "ok" ? "text-good" : "text-danger"
            }`}
          >
            {status.kind === "ok" ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
            {status.message}
          </span>
        ) : null}
        {links.length === 0 ? (
          <span className="text-[12.5px] text-danger">
            A menu with no items cannot be saved.
          </span>
        ) : null}
      </div>
    </div>
  );
}
