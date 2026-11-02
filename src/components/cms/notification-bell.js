"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon } from "@/components/icons";

/**
 * The notification bell.
 *
 * Built against docs/design/notifications.md. Two decisions there are worth
 * repeating here because they look like oversights:
 *
 *   OPENING THE PANEL DOES NOT MARK EVERYTHING READ. Someone opens it to
 *   glance, the phone locks, and the whole queue is gone. Rows mark read when
 *   tapped; "Mark all read" is deliberate and explicit.
 *
 *   READ ROWS STAY, DIMMED. Removing a row the moment it is read makes the
 *   list jump under a thumb that is already moving toward the next one.
 *
 * The unread COUNT is rendered on the server with the rest of the shell, and
 * the rows are fetched only when the panel is opened. That removes a fetch on
 * every navigation — the desk is on mobile data and the list is usually not
 * looked at — and it is what a correct count needs anyway: server-rendered, not
 * reconstructed in an effect.
 */

function BellIcon({ size = 19, filled = false }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-2 9-2 9h16s-2-2-2-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.12 : 0}
      />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function when(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationBell({ className = "", initialUnread = 0 }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null); // null = not fetched yet
  const [unread, setUnread] = useState(initialUnread);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function load() {
    setError(false);
    setRows(null);
    try {
      const response = await fetch("/api/admin/notifications");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setRows(data.notifications);
      setUnread(data.unread);
    } catch {
      setError(true);
      setRows([]);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Fetched on open, not on mount. Nothing is loaded for a desk that never
    // taps the bell.
    if (next) load();
  }

  async function mark({ id, all }) {
    // Optimistic: the desk should not wait on a round trip to see a dot clear.
    setRows((prev) =>
      (prev ?? []).map((row) => (all || row.id === id ? { ...row, read: true } : row))
    );
    setUnread((prev) => (all ? 0 : Math.max(0, prev - 1)));

    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(all ? { all: true } : { id }),
    }).catch(() => {});
  }

  function openRow(row) {
    if (!row.read) mark({ id: row.id });
    setOpen(false);
    if (row.href) router.push(row.href);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-paper-text-muted transition-colors hover:text-paper-text ${className}`}
      >
        <BellIcon filled={unread > 0} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9.5px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Tapping away closes it. On a phone this is most of how it gets
              dismissed, so it has to cover the whole screen. */}
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className="fixed inset-x-2 bottom-2 z-50 max-h-[70vh] overflow-hidden rounded-2xl border border-paper-line bg-card shadow-2xl shadow-ink/20 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-11 sm:w-[340px]">
            <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
              <p className="text-[14px] font-bold text-paper-text">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => mark({ all: true })}
                  className="text-[12px] font-bold text-accent-deep"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[calc(70vh-49px)] overflow-y-auto">
              {rows === null ? (
                <div className="flex flex-col gap-2 p-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-paper-dim" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-5 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-paper-text">
                    <AlertIcon size={13} /> Couldn&apos;t load notifications.
                  </p>
                  <button
                    type="button"
                    onClick={load}
                    className="mt-2 text-[12.5px] font-bold text-accent-deep"
                  >
                    Try again
                  </button>
                </div>
              ) : rows.length === 0 ? (
                <p className="p-6 text-center text-[13px] leading-relaxed text-paper-text-muted">
                  Nothing new. Enquiries and bookings will show up here.
                </p>
              ) : (
                <ul>
                  {rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => openRow(row)}
                        className={`flex w-full items-start gap-2.5 border-b border-paper-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-paper-dim ${
                          row.read ? "opacity-60" : ""
                        }`}
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            row.read ? "bg-transparent" : "bg-accent"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold leading-snug text-paper-text">
                            {row.title}
                          </span>
                          {row.body && (
                            <span className="mt-0.5 block truncate text-[12px] text-paper-text-muted">
                              {row.body}
                            </span>
                          )}
                          <span className="mt-0.5 block font-mono text-[10px] text-paper-text-faint">
                            {when(row.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
