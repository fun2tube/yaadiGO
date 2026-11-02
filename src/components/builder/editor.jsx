"use client";

import { useCallback, useState } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { config, emptyPage } from "./config";

/**
 * The visual editor.
 *
 * Puck owns the canvas, the drag-and-drop and the field panel; this component
 * owns saving. Three behaviours that are ours rather than Puck's:
 *
 *   AUTOSAVE TO DRAFT, PUBLISH DELIBERATELY. Every change writes to a draft
 *   nobody can see. The public page changes only when somebody presses
 *   Publish. An editor who closes the tab mid-thought has lost nothing and
 *   broken nothing.
 *
 *   REVERT IS ALWAYS AVAILABLE. "Back to the coded page" drops the published
 *   layout and the site returns to what is in git. There is no state this
 *   editor can get the site into that a single button cannot undo.
 *
 *   SAVE STATUS IS VISIBLE. A builder that saves silently trains people to
 *   press Publish after every change to be sure.
 */
export default function Editor({ path, initialData }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (action, data) => {
      setBusy(true);
      try {
        const response = await fetch("/api/admin/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, action, data }),
        });
        const body = await response.json();
        if (!response.ok) {
          setStatus({ kind: "error", message: body.message ?? "Couldn't save that." });
          return false;
        }
        setStatus({
          kind: "ok",
          message:
            action === "publish"
              ? "Published — this is what visitors see now."
              : action === "unpublish"
                ? "Reverted. The page in the code is live again."
                : "Draft saved.",
        });
        return true;
      } catch {
        setStatus({ kind: "error", message: "Couldn't reach the server." });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [path]
  );

  return (
    <div className="fixed inset-0 z-[80] bg-paper">
      <Puck
        config={config}
        data={initialData ?? emptyPage}
        onChange={(data) => send("draft", data)}
        onPublish={(data) => send("publish", data)}
        /**
         * Phone first, literally — it is the first button in the row and the
         * one the canvas opens on.
         *
         * Most of this site's traffic is a mid-range Android, and an editor
         * who only ever sees a 1280px canvas will make decisions that look
         * wrong where the customers are. Putting the desktop view last is a
         * small, deliberate inconvenience aimed at the person editing.
         *
         * 360 is the real floor — the width a Redmi or a Galaxy A-series
         * reports — not the 390 of an iPhone, which flatters a layout.
         */
        viewports={[
          { width: 360, height: "auto", label: "Phone", icon: "Smartphone" },
          { width: 768, height: "auto", label: "Tablet", icon: "Tablet" },
          { width: 1280, height: "auto", label: "Desktop", icon: "Monitor" },
        ]}
        /**
         * The canvas renders in an iframe so the page's own CSS — the reel
         * snap-scrolling, the `md:hidden` bottom bar, every breakpoint —
         * resolves against the VIEWPORT WIDTH rather than the browser window.
         * Without it a 360px preview is just a narrow box still being told it
         * is on a desktop, and every media query lies.
         */
        iframe={{ enabled: true }}
        overrides={{
          headerActions: ({ children }) => (
            <>
              <span
                className={`mr-3 self-center text-[12.5px] ${
                  status?.kind === "error" ? "text-danger" : "text-paper-text-faint"
                }`}
              >
                {busy ? "Saving…" : (status?.message ?? "")}
              </span>
              <button
                type="button"
                onClick={async () => {
                  // Destructive enough to confirm: it takes the page the
                  // editor has been working on off the live site.
                  if (!window.confirm("Revert to the page in the code? Your draft is kept.")) return;
                  await send("unpublish");
                }}
                className="mr-2 rounded-lg border border-paper-line-strong px-3 py-1.5 text-[12.5px] font-semibold"
              >
                Revert to coded page
              </button>
              <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-2 self-center text-[12.5px] font-semibold underline"
              >
                View live
              </a>
              {children}
            </>
          ),
        }}
      />
    </div>
  );
}
