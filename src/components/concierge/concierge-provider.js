"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const ConciergeContext = createContext(null);

export function useConcierge() {
  const value = useContext(ConciergeContext);
  if (!value) throw new Error("useConcierge must be used inside <ConciergeProvider>");
  return value;
}

const STORAGE_KEY = "yaadigo:concierge";

/**
 * Derives what the visitor is looking at from the URL alone.
 *
 * Deliberately not a registration API where each page announces itself: that
 * would mean a child writing to parent state inside an effect on every
 * navigation, which is both a cascading render and easy to forget on a new
 * page. The pathname is already the source of truth.
 */
function contextFromPath(pathname) {
  const tour = /^\/group-tours\/([^/]+)/.exec(pathname);
  if (tour) return { page: "a group tour's detail page", tripSlug: tour[1] };

  const post = /^\/blog\/([^/]+)/.exec(pathname);
  if (post) return { page: `a blog post (${post[1]})` };

  const MAP = {
    "/": "the homepage",
    "/group-tours": "the group tours listing",
    "/customized-tours": "the customized tours page",
    "/corporate-travel": "the corporate travel page",
    "/corporate": "the Corporate Travel Desk landing page",
    "/plan": "the AI trip planner",
    "/contact": "the contact page",
    "/about": "the about page",
    "/blog": "the blog index",
  };
  return { page: MAP[pathname] ?? pathname };
}

/** Reads an SSE body. Same shape as the planner's reader. */
async function* readEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const event = /^event: (.+)$/m.exec(raw)?.[1];
      const data = /^data: (.+)$/m.exec(raw)?.[1];
      if (event && data) {
        try {
          yield { event, data: JSON.parse(data) };
        } catch {
          /* skip a malformed frame rather than killing the stream */
        }
      }
    }
  }
}

export default function ConciergeProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [toolLabel, setToolLabel] = useState(null);
  const [error, setError] = useState(null);

  const pathname = usePathname();
  const abortRef = useRef(null);
  const restored = useRef(false);

  const persist = useCallback((next) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-40)));
    } catch {
      // Private mode, blocked storage — the conversation just won't survive a
      // reload. Never a reason to break the chat.
    }
  }, []);

  // Restored on first open rather than in an effect: reading storage during
  // render or in an effect risks a hydration mismatch, and an event handler
  // is the right place for a side effect anyway.
  const openPanel = useCallback(() => {
    if (!restored.current) {
      restored.current = true;
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
        }
      } catch {
        /* ignore */
      }
    }
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => setOpen(false), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setToolLabel(null);
    setStreaming(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const history = [...messages, { role: "user", content: trimmed }];
      setMessages([...history, { role: "assistant", content: "", cards: [] }]);
      setStreaming(true);
      setError(null);
      setToolLabel(null);

      // Only role/content go to the server — cards are a rendering concern and
      // resending them would waste context on every turn.
      const wire = history.map(({ role, content }) => ({ role, content }));

      try {
        const response = await fetch("/api/concierge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: wire, context: contextFromPath(pathname) }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => ({}));
          setError(payload.message ?? "The concierge isn't reachable right now.");
          setMessages(history);
          return;
        }

        const patchLast = (patch) =>
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, ...patch(last) };
            return next;
          });

        for await (const { event, data } of readEvents(response)) {
          if (event === "text") {
            setToolLabel(null);
            patchLast((last) => ({ content: last.content + data.text }));
          } else if (event === "tool") {
            setToolLabel(data.name);
          } else if (event === "cards") {
            patchLast((last) => ({ cards: [...(last.cards ?? []), ...data.cards] }));
          } else if (event === "error") {
            setError(data.message);
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          // Drop an assistant turn that produced nothing — an error before the
          // first token, or a stream that ended empty. Kept, it is replayed as
          // empty content on the next turn and the conversation jams: every
          // later message comes back rejected and the only escape is Clear.
          if (last?.role === "assistant" && !last.content && !last.cards?.length) next.pop();
          persist(next);
          return next;
        });
      } catch (err) {
        if (err?.name !== "AbortError") {
          setError("The connection dropped. Please try again.");
          setMessages(history);
        }
      } finally {
        setStreaming(false);
        setToolLabel(null);
      }
    },
    [messages, pathname, persist, streaming]
  );

  const value = useMemo(
    () => ({
      open,
      openPanel,
      closePanel,
      messages,
      streaming,
      toolLabel,
      error,
      send,
      reset,
      pathname,
    }),
    [open, openPanel, closePanel, messages, streaming, toolLabel, error, send, reset, pathname]
  );

  return <ConciergeContext.Provider value={value}>{children}</ConciergeContext.Provider>;
}
