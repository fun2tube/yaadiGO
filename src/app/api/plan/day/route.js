import { z } from "zod";

import {
  getProvider,
  enforceRateLimit,
  describeError,
  PlannerUnavailableError,
} from "@/lib/ai";
import {
  DaySchema,
  ItinerarySchema,
  PlanRequestSchema,
  SYSTEM_PROMPT,
  buildDayPrompt,
} from "@/lib/planner";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REGENERATIONS_PER_HOUR = 40;

const TRUNCATED = new Set(["MAX_TOKENS", "length"]);
const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "content_filter"]);

const BodySchema = z.object({
  input: PlanRequestSchema,
  itinerary: ItinerarySchema,
  dayNumber: z.number().int().min(1).max(21),
  instruction: z.string().trim().max(300).optional().or(z.literal("")),
});

/**
 * Models served by the free tiers wrap JSON in a markdown fence far more often
 * than frontier ones do, even when asked not to. Stripping it here is cheaper
 * than losing a regeneration to it.
 */
function unfence(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

export async function POST(request) {
  try {
    enforceRateLimit(request, "day", REGENERATIONS_PER_HOUR);

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ message: "That request didn't look right." }, { status: 400 });
    }

    const { input, itinerary, dayNumber, instruction } = parsed.data;

    if (!itinerary.days.some((d) => d.day === dayNumber)) {
      return Response.json({ message: "That day isn't in this itinerary." }, { status: 400 });
    }

    const provider = getProvider();
    if (!provider) throw new PlannerUnavailableError();

    // One day is small and fast, so no streaming here.
    const { text, finishReason } = await provider.generateJson({
      system: SYSTEM_PROMPT,
      prompt: buildDayPrompt({ input, itinerary, dayNumber, instruction }),
      schema: DaySchema,
      maxOutputTokens: 8000,
      signal: request.signal,
    });

    if (BLOCKED.has(finishReason)) {
      return Response.json(
        { message: "The planner declined to rewrite that day." },
        { status: 422 }
      );
    }

    // Nothing validates this for us, so it is parsed and checked here. A model
    // that returns prose or half a JSON object must not reach the page as a
    // broken day card.
    let day = null;
    try {
      const validated = DaySchema.safeParse(JSON.parse(unfence(text)));
      if (validated.success) day = validated.data;
      else console.error("[planner] day failed validation", validated.error.issues[0]);
    } catch {
      console.error("[planner] day was not valid JSON");
    }

    if (!day) {
      return Response.json(
        {
          message: TRUNCATED.has(finishReason)
            ? "That day came back too long to finish. Try a shorter instruction."
            : "The planner couldn't rewrite that day. Try again.",
        },
        { status: 502 }
      );
    }

    // Trust our own numbering over the model's.
    return Response.json({ day: { ...day, day: dayNumber } });
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ message }, { status });
  }
}
