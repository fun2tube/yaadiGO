import "server-only";

import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";

/**
 * Google Gemini, behind the same interface as the OpenAI-compatible adapter.
 *
 * Gemini is not OpenAI-compatible, so it needs its own file — the differences
 * that matter are the "model" role instead of "assistant", tool results going
 * back as a user turn, and thought signatures (see below).
 */

/**
 * Keywords Gemini's `responseJsonSchema` does not accept.
 *
 * It takes a SUBSET of JSON Schema. Send it a keyword outside that subset and
 * the whole request fails with `400 INVALID_ARGUMENT · Request contains an
 * invalid argument` — which names neither the keyword nor the field, so the
 * feature simply looks broken.
 *
 * That is what killed the AI quotation builder. `QuoteDraftSchema` carries
 * `.min()`/`.max()` on strings and arrays throughout, which zod renders as
 * minLength/maxLength/minItems/maxItems. The planner's `ItinerarySchema` has no
 * bounds at all, which is the only reason it worked — the difference was
 * accidental, not designed.
 *
 * Stripping these loses nothing: **zod still validates the parsed response**,
 * so every bound is enforced where it actually matters. They were only ever
 * advisory to the model. The descriptions, which do real work in steering
 * output, are kept.
 */
const UNSUPPORTED_KEYWORDS = [
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minProperties",
  "maxProperties",
  "pattern",
  "patternProperties",
  "additionalProperties",
  "unevaluatedProperties",
  "const",
  "default",
  "examples",
  "$schema",
  "$id",
  "not",
  "if",
  "then",
  "else",
];

/** Depth-first strip. Returns a new object; the caller's schema is untouched. */
function stripUnsupported(node) {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== "object") return node;

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.includes(key)) continue;
    out[key] = stripUnsupported(value);
  }

  // `const: "INR"` is how zod renders z.literal(). Dropping it outright would
  // let the model pick any string, so it becomes a single-value enum — which
  // Gemini does accept, and which pins the value just as tightly.
  if ("const" in node && !Array.isArray(node.const) && typeof node.const !== "object") {
    out.enum = [node.const];
  }

  return out;
}

function toJsonSchema(schema) {
  return stripUnsupported(z.toJSONSchema(schema, { target: "draft-7" }));
}

/**
 * Did the SSE stream die mid-response?
 *
 * The SDK's own wording, thrown from processStreamResponse when the reader
 * finishes with an unconsumed partial event in its buffer. Matched on the
 * message because the SDK gives it no code or type of its own — so this is
 * checked narrowly, and anything else is rethrown untouched.
 */
function isTruncatedStream(error) {
  return /Incomplete JSON segment|Response body is empty|terminated|ECONNRESET|socket hang up/i.test(
    String(error?.message ?? error)
  );
}

function toFunctionDeclaration(tool) {
  const parameters = toJsonSchema(tool.inputSchema);
  // The API rejects this key on a declaration.
  delete parameters.additionalProperties;
  return { name: tool.name, description: tool.description, parameters };
}

async function runSafely(tool, input) {
  try {
    return await tool.run(input);
  } catch (error) {
    console.error(`[ai] tool "${tool.name}" threw`, error);
    return { error: "That lookup failed. Answer from what you already know." };
  }
}

/** Out of quota (429) or this model is unreachable right now (503/502). */
function isExhausted(error) {
  const status = Number(error?.status ?? error?.code ?? 0);
  if (status === 429 || status === 503 || status === 502) return true;
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|quota/i.test(String(error?.message ?? error));
}

/**
 * The fallback ladder.
 *
 * MEASURED, 2026-09-30: **Gemini's free daily quota is per model, not per
 * key.** After ~20 test generations `gemini-3.6-flash` returned 429
 * RESOURCE_EXHAUSTED while `gemini-3.5-flash` on the same key answered 200.
 *
 * That makes this the whole free-tier strategy: one model's daily limit is
 * small enough that light testing exhausts it, and six working models give
 * roughly six times the headroom for no money and no extra accounts.
 *
 * Order is deliberate — full `flash` models first because the planner writes
 * long structured itineraries and the `lite` variants drop detail on them, then
 * lite as a working-but-thinner last resort. Better a plainer itinerary than
 * the apology the visitor used to get.
 */
const FALLBACK_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

/** How long a demoted model stays demoted before we try the preferred one again. */
const RETRY_PREFERRED_AFTER = 60 * 60 * 1000;

export function createGemini({ apiKey, model, thinkingBudget, adminThinkingBudget }) {
  const client = new GoogleGenAI({ apiKey });

  const thinking = (override) => ({
    thinkingConfig: { thinkingBudget: override ?? thinkingBudget },
  });

  // The configured model is always first; the ladder fills in behind it.
  const ladder = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];

  // Which rung we are on, remembered across requests — re-probing a model
  // known to be out of quota on every single request wastes a round trip and
  // delays the visitor for nothing.
  let rung = 0;
  let demotedAt = 0;

  function activeModel() {
    // Daily quotas reset and per-minute limits clear, so drop back to the
    // preferred model periodically rather than staying demoted until restart.
    if (rung > 0 && Date.now() - demotedAt > RETRY_PREFERRED_AFTER) rung = 0;
    return ladder[rung];
  }

  /** Move down the ladder. False when there is nowhere left to go. */
  function demote(from, error) {
    if (rung >= ladder.length - 1) return false;
    rung += 1;
    demotedAt = Date.now();
    console.warn(
      `[ai] ${from} unavailable (${error?.status ?? "quota"}); falling back to ${ladder[rung]}`
    );
    return true;
  }

  return {
    id: "gemini",
    label: "Gemini",
    model,
    adminThinkingBudget,

    /**
     * Streamed JSON, with a non-streamed fallback.
     *
     * MEASURED, 2026-09-30, free tier, identical request repeated: three of six
     * attempts died with the SDK's "Incomplete JSON segment at the end", and a
     * later run failed four times in five. It is not the schema and not the
     * model — it is the free tier dropping the SSE connection mid-event, and
     * the SDK throwing rather than surrendering what it had. Failures split two
     * ways: most yield nothing at all, some die part-way (26 chunks in one).
     *
     * Non-streamed `generateContent` did not fail once in the same conditions —
     * one request, one response, nothing to truncate. So a dead stream retries
     * there instead of becoming the visitor's problem.
     *
     * The cost is only that a retried generation appears all at once instead of
     * day by day, which is a far better outcome than the error the visitor used
     * to get on roughly half of all attempts.
     */
    async *streamJson({ system, prompt, schema, maxOutputTokens, signal }) {
      const contents = [{ role: "user", parts: [{ text: prompt }] }];
      const config = {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: toJsonSchema(schema),
        maxOutputTokens,
        ...thinking(),
      };

      let sentText = false;

      // Walk down the ladder until a model answers. Each iteration gets one
      // streamed attempt and, if the stream breaks, one non-streamed retry on
      // the same model before moving on.
      /**
       * Anything already sent belongs to an attempt that has since died, and
       * would concatenate with this one into unparseable JSON. So every fresh
       * attempt announces itself and the consumer drops its buffer.
       *
       * This has to sit in front of BOTH retry paths — the non-streamed retry
       * on the same model, and the streamed retry on the next model down.
       * Guarding only the first produced exactly one failure in three: six days
       * streamed from one model, then a whole new document streamed from
       * another into the same buffer, and an itinerary that "couldn't be read".
       */
      const beginAttempt = function* () {
        if (!sentText) return;
        yield { type: "reset" };
        sentText = false;
      };

      for (;;) {
        const attempt = activeModel();

        try {
          yield* beginAttempt();
          const stream = await client.models.generateContentStream({
            model: attempt,
            contents,
            config,
            abortSignal: signal,
          });

          for await (const chunk of stream) {
            if (signal?.aborted) return;
            const candidate = chunk.candidates?.[0];
            for (const part of candidate?.content?.parts ?? []) {
              if (part.thought || typeof part.text !== "string" || !part.text) continue;
              sentText = true;
              yield { type: "text", text: part.text };
            }
            if (candidate?.finishReason) yield { type: "finish", reason: candidate.finishReason };
          }
          return;
        } catch (error) {
          if (signal?.aborted) return;

          // Out of quota, or this model is unreachable — a different model may
          // well work, because the quota is per model.
          if (isExhausted(error)) {
            if (demote(attempt, error)) continue;
            throw error;
          }

          // A broken stream is worth one non-streamed retry. Anything else —
          // a rejected key, a bad schema — must surface as itself; retrying
          // those burns quota and delays an accurate message.
          if (!isTruncatedStream(error)) throw error;
          console.warn(`[ai] ${attempt} stream broke mid-response; retrying non-streamed`);
        }

        try {
          yield* beginAttempt();
          const response = await client.models.generateContent({
            model: attempt,
            contents,
            config,
            abortSignal: signal,
          });
          if (signal?.aborted) return;

          const text = response.text ?? "";
          if (text) yield { type: "text", text };
          const finishReason = response.candidates?.[0]?.finishReason;
          if (finishReason) yield { type: "finish", reason: finishReason };
          return;
        } catch (error) {
          if (signal?.aborted) return;
          if (isExhausted(error) && demote(attempt, error)) continue;
          throw error;
        }
      }
    },

    async generateJson({ system, prompt, schema, maxOutputTokens, signal }) {
      const contents = [{ role: "user", parts: [{ text: prompt }] }];
      const config = {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: toJsonSchema(schema),
        maxOutputTokens,
        ...thinking(),
      };

      // Same ladder as streamJson. This path backs the quotation builder, where
      // an exhausted quota means a salesperson cannot send a price — so it is
      // worth trying every model before giving up.
      for (;;) {
        const attempt = activeModel();
        try {
          const response = await client.models.generateContent({
            model: attempt,
            contents,
            config,
            abortSignal: signal,
          });
          return {
            text: response.text ?? "",
            finishReason: response.candidates?.[0]?.finishReason,
          };
        } catch (error) {
          if (signal?.aborted) throw error;
          if (isExhausted(error) && demote(attempt, error)) continue;
          throw error;
        }
      }
    },

    async *streamWithTools({
      system,
      messages,
      tools,
      maxOutputTokens,
      maxTurns = 6,
      thinkingBudget: override,
      signal,
    }) {
      const byName = new Map(tools.map((tool) => [tool.name, tool]));
      const functionDeclarations = tools.map(toFunctionDeclaration);
      const history = messages.map((message) => ({
        // Gemini calls the assistant "model".
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

      // Resolved ONCE, before the first turn, and held for the whole
      // conversation. It reads the same ladder as the other two methods — so a
      // demotion triggered by the planner benefits this too — but deliberately
      // does not switch models part-way through: `thoughtSignature` has to be
      // echoed back to the model that issued it, and a mid-conversation switch
      // would send one model's signatures to another and break the history.
      // A conversation that starts on a working model finishes on it.
      let conversationModel = activeModel();

      /**
       * Open the first turn, retrying down the ladder.
       *
       * MEASURED during the system audit: Yaadi failed **three requests in
       * five** with a transient 503, while the planner — which has this ladder
       * — succeeded every time. The difference was that this method picked one
       * model and gave up on it. A concierge that fails most of the time is
       * worse than no concierge, because the visitor concludes the whole site
       * is broken.
       *
       * Only safe BEFORE any history exists. Once the model has issued a
       * `thoughtSignature`, that signature has to go back to the model that
       * made it, so a mid-conversation switch would corrupt the history — which
       * is why the model is still pinned for the rest of the turns.
       */
      async function openStream(contents, isFirstTurn) {
        for (;;) {
          try {
            return await client.models.generateContentStream({
              model: conversationModel,
              contents,
              config: {
                systemInstruction: system,
                maxOutputTokens,
                tools: [{ functionDeclarations }],
                ...thinking(override),
              },
              abortSignal: signal,
            });
          } catch (error) {
            if (signal?.aborted || !isFirstTurn || !isExhausted(error)) throw error;
            if (!demote(conversationModel, error)) throw error;
            conversationModel = activeModel();
          }
        }
      }

      for (let turn = 0; turn < maxTurns; turn += 1) {
        if (signal?.aborted) return;

        const stream = await openStream(history, turn === 0);

        const calls = [];
        const parts = [];

        for await (const chunk of stream) {
          if (signal?.aborted) return;

          for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
            // Kept VERBATIM for the history we send back.
            //
            // Rebuilding these as {functionCall} dropped the thoughtSignature
            // Gemini attaches to a tool call, and the next turn was rejected:
            //   400 — "Function call is missing a thought_signature in
            //          functionCall parts"
            // So a tool would run, its cards would render, and the reply that
            // should have explained them never arrived.
            parts.push(part);

            if (part.functionCall) {
              calls.push(part.functionCall);
            } else if (!part.thought && typeof part.text === "string" && part.text) {
              yield { type: "text", text: part.text };
            }
          }
        }

        if (calls.length === 0) return;

        history.push({ role: "model", parts });

        const responses = [];
        for (const call of calls) {
          const tool = byName.get(call.name);
          let result;

          if (!tool) {
            result = { error: `No such tool: ${call.name}` };
          } else {
            const parsed = tool.inputSchema.safeParse(call.args ?? {});
            result = parsed.success
              ? await runSafely(tool, parsed.data)
              : { error: `Invalid arguments: ${parsed.error.issues[0]?.message ?? "unknown"}` };
          }

          yield { type: "tool", name: call.name, result };
          responses.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              // The API wants an object here; a bare array or string is rejected.
              response: result && typeof result === "object" ? result : { value: result },
            },
          });
        }

        // Tool results go back as a USER turn in Gemini, not a "tool" role.
        history.push({ role: "user", parts: responses });
      }

      yield {
        type: "text",
        text: "\n\nI'm going round in circles on that one — let me put you onto the travel desk.",
      };
    },

    describeApiError(error) {
      if (!(error instanceof ApiError)) return null;
      return { status: error.status, text: error.message ?? "", provider: "Gemini" };
    },
  };
}
