"use client";

import { useEffect, useRef, useState } from "react";
import { useConcierge } from "./concierge-provider";
import ConciergeCards from "./cards";
import { SparkleIcon, ChevronIcon, AlertIcon } from "@/components/icons";
import { TOOL_LABELS } from "./tool-labels";

/** Openers tuned to the page, so the first tap is never a blank box. */
function suggestionsFor(pathname) {
  if (/^\/group-tours\/[^/]+/.test(pathname)) {
    return ["Which dates still have seats?", "Is this a good time of year?", "What's not included?"];
  }
  if (pathname === "/group-tours") {
    return ["What's leaving next month?", "Under \u20b925,000?", "Somewhere in the mountains"];
  }
  if (pathname === "/plan") {
    return ["Is Kashmir good in October?", "Show me fixed departures instead"];
  }
  if (pathname.startsWith("/corporate")) {
    return ["How does the wallet work?", "What does the AI finance agent do?", "Talk to someone"];
  }
  return ["What's leaving in the next month?", "Beach trip under \u20b920,000", "Somewhere quiet in December"];
}


function Message({ message, onClose }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink-text">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div>
      {message.content && (
        <div className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-paper-dim px-3.5 py-2.5 text-[13.5px] leading-relaxed text-paper-text">
          {message.content}
        </div>
      )}
      <ConciergeCards cards={message.cards} onClose={onClose} />
    </div>
  );
}

export default function ConciergePanel() {
  const { open, closePanel, messages, streaming, toolLabel, error, send, reset, pathname } =
    useConcierge();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest message in view as tokens stream in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, toolLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  if (!open) return null;

  function submit(event) {
    event.preventDefault();
    const text = draft;
    setDraft("");
    send(text);
    inputRef.current?.focus();
  }

  const empty = messages.length === 0;

  return (
    <>
      {/* Scrim. On desktop it is subtle — the point is to stay beside the page,
          not to take it over. */}
      <button
        type="button"
        aria-label="Close Yaadi"
        onClick={closePanel}
        className="no-print fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px] md:bg-ink/20"
      />

      <aside
        role="dialog"
        aria-label="Yaadi, the YaadiGo travel assistant"
        className="no-print fixed inset-x-0 bottom-0 z-[61] flex h-[86dvh] flex-col rounded-t-3xl border border-paper-line bg-paper shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[420px] md:rounded-none md:rounded-l-3xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-paper-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white">
              <SparkleIcon size={16} />
            </span>
            <div className="leading-none">
              <p className="text-[14px] font-black text-paper-text">Yaadi</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-paper-text-faint">
                YaadiGo travel assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-paper-text-faint transition-colors hover:text-paper-text"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-paper-text-muted transition-colors hover:bg-paper-dim"
            >
              <ChevronIcon size={16} dir="right" />
            </button>
          </div>
        </header>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {empty && (
            <div className="flex h-full flex-col justify-center">
              <p className="font-display text-[19px] font-black leading-snug text-paper-text">
                Hi, I&apos;m Yaadi.
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-paper-text-muted">
                Tell me roughly where and when, and I&apos;ll find you a departure that actually has
                seats — with real dates and real prices. I&apos;ll be straight with you about whether
                your timing works, and hand you to a human the moment you want to book.
              </p>
            </div>
          )}

          {!empty && (
            <div className="flex flex-col gap-4">
              {messages.map((message, i) => (
                <Message key={i} message={message} onClose={closePanel} />
              ))}

              {toolLabel && (
                <div className="flex items-center gap-2 text-[12px] font-semibold text-accent-deep">
                  <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  {TOOL_LABELS[toolLabel] ?? "Working"}…
                </div>
              )}

              {streaming && !toolLabel && messages.at(-1)?.content === "" && (
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-paper-text-faint"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
              <span className="mt-0.5 shrink-0 text-danger">
                <AlertIcon size={14} />
              </span>
              <p className="text-[12.5px] leading-relaxed text-paper-text">{error}</p>
            </div>
          )}
        </div>

        {/* Suggestions + composer */}
        <div className="border-t border-paper-line px-4 pb-4 pt-3">
          {!streaming && (
            <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {suggestionsFor(pathname).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="shrink-0 rounded-full border border-paper-line-strong px-3 py-1.5 text-[12px] font-semibold text-paper-text-muted transition-colors hover:border-accent hover:text-accent-deep"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="flex items-end gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Where do you want to go?"
              maxLength={4000}
              className="min-w-0 flex-1 rounded-xl border border-paper-line-strong bg-card px-3.5 py-3 text-[14px] text-paper-text outline-none transition-colors focus:border-accent"
            />
            <button
              type="submit"
              disabled={streaming || !draft.trim()}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-transform active:scale-95 disabled:opacity-40"
              aria-label="Send"
            >
              <ChevronIcon size={18} dir="right" className="-rotate-90" />
            </button>
          </form>

          <p className="mt-2 text-center text-[10.5px] leading-snug text-paper-text-faint">
            Yaadi answers from our real departures. Availability and firm pricing are always
            confirmed by a human before you pay.
          </p>
        </div>
      </aside>
    </>
  );
}
