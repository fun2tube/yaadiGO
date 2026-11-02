import "server-only";

import { z } from "zod";

/**
 * Any OpenAI-compatible endpoint.
 *
 * Which is nearly all of them: Groq, OpenRouter, Cerebras, Together, Mistral,
 * DeepInfra, a self-hosted vLLM or llama.cpp server, and Ollama all speak this
 * shape. One adapter therefore covers every free tier serving open-weight
 * models AND the eventual "run it on our own box" answer, with a base URL and
 * a model name as the only difference between them.
 *
 * Written against `fetch` rather than the openai package on purpose: the wire
 * format is the stable part, the SDK adds a dependency and a version to keep
 * in step, and some of these endpoints only implement a subset the SDK then
 * assumes is present.
 */

const DONE = "[DONE]";

class HttpError extends Error {
  constructor(status, body) {
    super(typeof body === "string" ? body : JSON.stringify(body));
    this.name = "OpenAICompatibleError";
    this.status = status;
    this.body = body;
  }
}

/** Read an SSE body as a sequence of parsed JSON payloads. */
async function* sseJson(response, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line; a chunk can split one in half,
      // so anything after the last separator stays in the buffer.
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        for (const line of raw.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === DONE) continue;
          try {
            yield JSON.parse(payload);
          } catch {
            // A truncated frame is not worth killing the stream for.
            console.warn("[ai] skipped an unparseable stream frame");
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

function toJsonSchema(schema) {
  const json = z.toJSONSchema(schema, { target: "draft-7" });
  delete json.$schema;
  return json;
}

export function createOpenAICompatible({ id, label, baseUrl, apiKey, model, strictJson, headers = {} }) {
  async function post(body, signal) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      let parsed;
      try {
        parsed = await response.json();
      } catch {
        parsed = await response.text().catch(() => "");
      }
      throw new HttpError(response.status, parsed);
    }
    return response;
  }

  /**
   * JSON output.
   *
   * `response_format: json_schema` is the strong option but is not universal,
   * so the schema also goes into the prompt. That is belt and braces on
   * purpose: the open-weight models these endpoints serve are markedly worse
   * at holding a long schema than the frontier models this site was built
   * against, and a malformed itinerary reaches the visitor as a broken page.
   */
  function jsonRequest({ system, prompt, schema, maxOutputTokens }) {
    const json = toJsonSchema(schema);
    return {
      model,
      max_tokens: maxOutputTokens,
      stream: true,
      response_format: strictJson
        ? { type: "json_schema", json_schema: { name: "result", schema: json, strict: true } }
        : { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${system}\n\nReply with JSON only — no prose, no markdown fence. It must match this schema exactly:\n${JSON.stringify(
            json
          )}`,
        },
        { role: "user", content: prompt },
      ],
    };
  }

  return {
    id,
    label,
    model,

    async *streamJson({ system, prompt, schema, maxOutputTokens, signal }) {
      const response = await post(jsonRequest({ system, prompt, schema, maxOutputTokens }), signal);

      for await (const frame of sseJson(response, signal)) {
        const choice = frame.choices?.[0];
        const text = choice?.delta?.content;
        if (text) yield { type: "text", text };
        if (choice?.finish_reason) yield { type: "finish", reason: choice.finish_reason };
      }
    },

    async generateJson({ system, prompt, schema, maxOutputTokens, signal }) {
      let text = "";
      let reason;
      for await (const event of this.streamJson({
        system,
        prompt,
        schema,
        maxOutputTokens,
        signal,
      })) {
        if (event.type === "text") text += event.text;
        else if (event.type === "finish") reason = event.reason;
      }
      return { text, finishReason: reason };
    },

    async *streamWithTools({ system, messages, tools, maxOutputTokens, maxTurns = 6, signal }) {
      const byName = new Map(tools.map((tool) => [tool.name, tool]));
      const declarations = tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: toJsonSchema(tool.inputSchema),
        },
      }));

      const history = [
        { role: "system", content: system },
        ...messages.map((message) => ({ role: message.role, content: message.content })),
      ];

      for (let turn = 0; turn < maxTurns; turn += 1) {
        if (signal?.aborted) return;

        const response = await post(
          {
            model,
            max_tokens: maxOutputTokens,
            stream: true,
            tools: declarations,
            tool_choice: "auto",
            messages: history,
          },
          signal
        );

        // Tool calls stream in fragments — the name arrives in one frame and
        // the arguments dribble in across many, keyed by index. They have to
        // be reassembled before any of them can run.
        const calls = new Map();
        let text = "";

        for await (const frame of sseJson(response, signal)) {
          const delta = frame.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            text += delta.content;
            yield { type: "text", text: delta.content };
          }

          for (const part of delta.tool_calls ?? []) {
            const slot = calls.get(part.index) ?? { id: "", name: "", args: "" };
            if (part.id) slot.id = part.id;
            if (part.function?.name) slot.name += part.function.name;
            if (part.function?.arguments) slot.args += part.function.arguments;
            calls.set(part.index, slot);
          }
        }

        if (calls.size === 0) return;

        history.push({
          role: "assistant",
          content: text || null,
          tool_calls: [...calls.entries()].map(([index, call]) => ({
            id: call.id || `call_${index}`,
            type: "function",
            function: { name: call.name, arguments: call.args || "{}" },
          })),
        });

        for (const [index, call] of calls) {
          const tool = byName.get(call.name);
          let result;

          if (!tool) {
            result = { error: `No such tool: ${call.name}` };
          } else {
            let args;
            try {
              args = JSON.parse(call.args || "{}");
            } catch {
              // Open-weight models truncate or mangle tool arguments far more
              // often than frontier ones. Handing the model its own mistake
              // lets it retry; throwing would end the conversation.
              args = null;
              result = { error: "Your arguments were not valid JSON. Call the tool again." };
            }
            if (args !== null) {
              const parsed = tool.inputSchema.safeParse(args);
              result = parsed.success
                ? await runSafely(tool, parsed.data)
                : { error: `Invalid arguments: ${parsed.error.issues[0]?.message ?? "unknown"}` };
            }
          }

          yield { type: "tool", name: call.name, result };
          history.push({
            role: "tool",
            tool_call_id: call.id || `call_${index}`,
            content: JSON.stringify(result ?? {}),
          });
        }
      }

      yield {
        type: "text",
        text: "\n\nI'm going round in circles on that one — let me put you onto the travel desk.",
      };
    },

    describeApiError(error) {
      if (!(error instanceof HttpError)) return null;
      const text = typeof error.body === "string" ? error.body : JSON.stringify(error.body ?? "");
      return { status: error.status, text, provider: label };
    },
  };
}

async function runSafely(tool, input) {
  try {
    return await tool.run(input);
  } catch (error) {
    console.error(`[ai] tool "${tool.name}" threw`, error);
    return { error: "That lookup failed. Answer from what you already know." };
  }
}

export { HttpError as OpenAICompatibleError };
