"use client";

import { useRef, useState } from "react";
import { SparkleIcon, AlertIcon } from "@/components/icons";

const TOOL_LABELS = {
  read_element: "Reading the element",
  set_text: "Rewriting the text",
  set_style: "Changing the styling",
  find_image: "Searching the media library",
  set_image: "Swapping the image",
  set_hidden: "Changing visibility",
  revert: "Reverting",
};

const SUGGESTIONS = [
  "Make this shorter and punchier",
  "Fix the tone — too salesy",
  "Make it bigger and bolder",
  "Rewrite for a family audience",
];

/**
 * Chat scoped to one element.
 *
 * The conversation is per-element and per-session on purpose: an editor
 * talking about "this heading" should never have the agent reach for context
 * from a different element they edited ten minutes ago.
 */
export default function AgentChat({ elementId, context, path, onChanged }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [tool, setTool] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const history = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setStreaming(true);
    setError(null);
    setTool(null);

    try {
      const response = await fetch("/api/admin/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elementId,
          path,
          context,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.message ?? "The assistant isn't reachable.");
        setMessages(history);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let changed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let split;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const event = /^event: (.+)$/m.exec(frame)?.[1];
          const raw = /^data: (.+)$/m.exec(frame)?.[1];
          if (!event || !raw) continue;

          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event === "text") {
            setTool(null);
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: next[next.length - 1].content + data.text,
              };
              return next;
            });
          } else if (event === "tool") {
            setTool(data.name);
          } else if (event === "error") {
            setError(data.message);
          } else if (event === "done") {
            changed = Boolean(data.changed);
          }
        }
      }

      // Only reload when something actually changed — a reload on a
      // question-only exchange would throw away the conversation for nothing.
      if (changed) {
        setTimeout(onChanged, 700);
      }
    } catch {
      setError("The connection dropped.");
      setMessages(history);
    } finally {
      setStreaming(false);
      setTool(null);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div>
            <p className="flex items-center gap-2 text-[13.5px] font-bold text-paper-text">
              <SparkleIcon size={15} className="text-accent-deep" />
              Describe the change
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-paper-text-muted">
              I can rewrite this element&apos;s text, change its size, weight, colour or typeface,
              swap its image, hide it, or put it back the way it was. I only touch the element you
              selected.
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-lg border border-paper-line-strong px-3 py-2 text-left text-[12.5px] font-medium text-paper-text-muted transition-colors hover:border-accent hover:text-accent-deep"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, i) =>
              message.role === "user" ? (
                <p
                  key={i}
                  className="self-end rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-[12.5px] leading-relaxed text-ink-text"
                >
                  {message.content}
                </p>
              ) : (
                message.content && (
                  <p
                    key={i}
                    className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-paper-dim px-3 py-2 text-[12.5px] leading-relaxed text-paper-text"
                  >
                    {message.content}
                  </p>
                )
              )
            )}
            {tool && (
              <p className="flex items-center gap-2 text-[11.5px] font-semibold text-accent-deep">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                {TOOL_LABELS[tool] ?? "Working"}…
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-[12px] text-paper-text">
            <span className="mt-0.5 shrink-0 text-danger">
              <AlertIcon size={12} />
            </span>
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-center gap-2 border-t border-paper-line p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Make this shorter…"
          maxLength={4000}
          className="min-w-0 flex-1 rounded-xl border border-paper-line-strong bg-card px-3 py-2.5 text-[13px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={streaming || !draft.trim()}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
