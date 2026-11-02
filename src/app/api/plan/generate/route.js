import {
  getProvider,
  enforceRateLimit,
  describeError,
  PlannerUnavailableError,
} from "@/lib/ai";
import {
  ItinerarySchema,
  PlanRequestSchema,
  SYSTEM_PROMPT,
  buildPlanPrompt,
} from "@/lib/planner";
import { createItineraryExtractor } from "@/lib/itinerary-stream";

// Streams, so it must run per-request.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GENERATIONS_PER_HOUR = 12;

// Finish reasons that mean "cut short", across providers: Gemini shouts,
// OpenAI-compatible endpoints whisper.
const TRUNCATED = new Set(["MAX_TOKENS", "length"]);
const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "content_filter"]);

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request) {
  let input;

  try {
    enforceRateLimit(request, "generate", GENERATIONS_PER_HOUR);

    const parsed = PlanRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { message: "That request didn't look right. Check the form and try again." },
        { status: 400 }
      );
    }
    input = parsed.data;

    if (!getProvider()) throw new PlannerUnavailableError();
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ message }, { status });
  }

  const provider = getProvider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => controller.enqueue(encoder.encode(sse(event, data)));

      // Days are pulled out of the JSON as it arrives, so the page fills in
      // day by day instead of sitting blank for the whole generation.
      let extractor = createItineraryExtractor();

      try {
        let finishReason;

        for await (const event of provider.streamJson({
          system: SYSTEM_PROMPT,
          prompt: buildPlanPrompt(input),
          schema: ItinerarySchema,
          maxOutputTokens: 32000,
          // The visitor navigating away or hitting stop must end the request:
          // otherwise we burn free-tier quota on tokens nobody will read.
          signal: request.signal,
        })) {
          if (request.signal.aborted) break;

          if (event.type === "finish") {
            finishReason = event.reason;
            continue;
          }

          // The provider abandoned a broken stream and started again. Anything
          // buffered belongs to the dead attempt and would concatenate into
          // unparseable JSON, so the extractor starts clean.
          //
          // Nothing is sent to the client here: it already replaces its
          // streamed preview with the `complete` document at the end, so the
          // days it has on screen are corrected either way.
          if (event.type === "reset") {
            extractor = createItineraryExtractor();
            finishReason = undefined;
            continue;
          }

          const { header, days } = extractor.push(event.text);
          if (header) send("header", header);
          for (const day of days) send("day", day);
        }

        if (request.signal.aborted) {
          controller.close();
          return;
        }

        // A blocked response arrives as a finish reason rather than an error,
        // so it has to be checked explicitly — otherwise it reads to the
        // visitor as "the planner produced gibberish".
        if (BLOCKED.has(finishReason)) {
          send("error", {
            message:
              "The planner declined to plan that particular trip. Try a different destination, or tell the travel desk directly.",
          });
          controller.close();
          return;
        }

        const itinerary = extractor.finish();
        if (!itinerary) {
          send("error", {
            message: TRUNCATED.has(finishReason)
              ? "That trip was too long to finish in one go. Try a shorter duration."
              : "The planner produced something we couldn't read. Please try again.",
          });
          controller.close();
          return;
        }

        // The authoritative document — the client replaces its streamed
        // preview with this, which fixes any day the preview dropped.
        send("complete", itinerary);
      } catch (error) {
        if (request.signal.aborted) {
          controller.close();
          return;
        }
        const { message } = describeError(error);
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tells nginx not to buffer the stream into one lump.
      "X-Accel-Buffering": "no",
    },
  });
}
