import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/cms/auth";
import { getField, patchField, resetField } from "@/lib/cms/store";
import { STYLE_GROUPS, sanitiseStyle } from "@/lib/cms/style-tokens";
import {
  getProvider,
  describeError,
  PlannerUnavailableError,
  ADMIN_THINKING_BUDGET,
} from "@/lib/ai";
import { media, searchImages } from "@/lib/media";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The editing agent.
 *
 * You click an element on the live site and describe the change in words; the
 * agent reads that element's current state and rewrites it through the same
 * validated store the manual inspector uses. It cannot write arbitrary CSS or
 * arbitrary HTML — its tools accept the same fixed token menu a human editor
 * gets, so "make it huge and neon" resolves to a real design-system size or
 * is refused.
 *
 * Every change it makes is a normal override, so "revert" undoes the agent's
 * work exactly as it undoes a human's.
 */

const ALLOWED_STYLE = Object.fromEntries(
  STYLE_GROUPS.map((group) => [group.key, group.options.map((option) => option.value)])
);

const SYSTEM = `You are the editing assistant inside YaadiGo's website admin. An editor has selected one element on a live page and wants to change it by describing the change.

You are editing a real, public travel website for a real business. Act like a careful colleague with commit access, not an enthusiastic intern.

## How to work

1. Call read_element first, always. You cannot change what you have not read.
2. Make the change with the smallest tool that does it. Rewriting copy is set_text; making it bigger is set_style; swapping a photo is set_image.
3. Then say in one short sentence what you changed. No preamble, no restating the whole element back.

## Copy rules

Match the voice of the surrounding site: plain, warm, specific, no brochure adjectives — nothing is "breathtaking", "nestled" or a "hidden gem". No exclamation marks, no emoji.

Never invent a fact. Prices, dates, seat counts, inclusions and durations are real commitments this business has to honour. If asked to write copy containing a fact you were not given, write the sentence without the fact and say what you left out.

Keep headings to roughly the length of what was there. Copy that doubles in length breaks the layout it sits in.

## Design rules

You may only use the listed style tokens. If someone asks for something outside them — a specific hex colour, a font the site does not load — say what the nearest available option is and make that change only if they want it.

Do not make text smaller than "sm" on a heading, and do not set body copy to "black" weight. If a request would hurt readability, say so in one line, then do it if they confirm.

## When to refuse

If an instruction would put a false claim on the page, decline and explain in one sentence. Everything else, just do.`;

export async function POST(request) {
  const denied = await requireAuth("content.write");
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
    if (!getProvider()) throw new PlannerUnavailableError();
  } catch (error) {
    const { status, message } = describeError(error, { audience: "admin" });
    return Response.json({ message }, { status });
  }

  const BodySchema = z.object({
    elementId: z.string().min(1).max(200),
    path: z.string().max(300).optional(),
    // What the element currently looks like on screen, so the agent can talk
    // about it without a round trip.
    context: z
      .object({ tag: z.string().max(20).optional(), visibleText: z.string().max(2000).optional() })
      .optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(4000),
        })
      )
      .min(1)
      .max(30),
  });

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "That request didn't look right." }, { status: 400 });
  }

  const { elementId, path, context, messages } = parsed.data;
  const provider = getProvider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      // Tracks whether anything actually changed, so the browser only reloads
      // the page when it needs to.
      let mutated = false;

      const tools = [
        {
          name: "read_element",
          description:
            "Read the selected element's current text, style overrides and image. Call this before any change.",
          inputSchema: z.object({}),
          run: async () => {
            const field = await getField(elementId);
            return {
              id: elementId,
              tag: context?.tag ?? null,
              currentlyOnPage: context?.visibleText ?? null,
              textOverride: field.text,
              styleOverride: field.style,
              imageOverride: field.image,
              hidden: field.hidden,
              note: field.text
                ? "This element has already been edited; textOverride is what visitors see."
                : "No text override yet — visitors see the default written in the code.",
              allowedStyleTokens: ALLOWED_STYLE,
            };
          },
        },

        {
          name: "set_text",
          description:
            "Replace the element's visible text. Use for rewriting copy, fixing wording, shortening or lengthening.",
          inputSchema: z.object({
            text: z.string().min(1).max(6000).describe("The new text, plain, no HTML"),
          }),
          run: async ({ text }) => {
            await patchField(elementId, { text });
            mutated = true;
            return { ok: true, newText: text };
          },
        },

        {
          name: "set_style",
          description:
            "Change the element's size, weight, colour, typeface or alignment. Only the listed tokens are accepted; anything else is dropped.",
          inputSchema: z.object({
            size: z.enum(ALLOWED_STYLE.size).optional(),
            weight: z.enum(ALLOWED_STYLE.weight).optional(),
            colour: z.enum(ALLOWED_STYLE.colour).optional(),
            font: z.enum(ALLOWED_STYLE.font).optional(),
            align: z.enum(ALLOWED_STYLE.align).optional(),
          }),
          run: async (input) => {
            const existing = (await getField(elementId)).style ?? {};
            const merged = sanitiseStyle({ ...existing, ...input });
            await patchField(elementId, { style: merged });
            mutated = true;
            return { ok: true, style: merged };
          },
        },

        {
          name: "find_image",
          description:
            "Search the media library. Use before set_image so you pick a real image, and so you can tell the editor what it shows.",
          inputSchema: z.object({
            query: z.string().max(80).describe("Destination, subject or tag"),
          }),
          run: ({ query }) => {
            const hits = searchImages(query).slice(0, 6);
            return {
              found: hits.length,
              images: hits.map((item) => ({
                id: item.id,
                title: item.title,
                alt: item.alt,
                tags: item.tags,
              })),
              totalInLibrary: media.length,
            };
          },
        },

        {
          name: "set_image",
          description:
            "Swap the image in this slot for one from the media library. The id must come from find_image.",
          inputSchema: z.object({
            imageId: z.string().max(120).describe("A media library id"),
          }),
          run: async ({ imageId }) => {
            if (!media.some((item) => item.id === imageId)) {
              return { error: `No image "${imageId}". Call find_image first.` };
            }
            await patchField(elementId, { image: imageId });
            mutated = true;
            return { ok: true, imageId };
          },
        },

        {
          name: "set_hidden",
          description:
            "Hide this element from the page, or show it again. Hiding is reversible and removes nothing from the code.",
          inputSchema: z.object({ hidden: z.boolean() }),
          run: async ({ hidden }) => {
            await patchField(elementId, { hidden });
            mutated = true;
            return { ok: true, hidden };
          },
        },

        {
          name: "revert",
          description:
            "Drop every override on this element and restore what the code says. Use when asked to undo or reset.",
          inputSchema: z.object({}),
          run: async () => {
            await resetField(elementId);
            mutated = true;
            return { ok: true, reverted: true };
          },
        },
      ];

      try {
        for await (const event of provider.streamWithTools({
          // Which element is selected belongs in the instruction, not in a
          // fake conversation turn: a turn the editor never typed gets echoed
          // back at them, and Gemini has no mid-conversation system role.
          system: `${SYSTEM}

The editor has selected element "${elementId}"${
            context?.tag ? ` (a <${context.tag}>)` : ""
          }. Every tool acts on this element.`,
          messages,
          tools,
          maxOutputTokens: 4000,
          // Thinking stays ON here, unlike the planner and Yaadi.
          //
          // This agent has write access to the live site, and with thinking
          // disabled Flash rewrote an Indian company's homepage heading to
          // "The quieter side of Jamaica" — invented, off-brand, and saved
          // without anyone seeing it first. Admin traffic is a handful of
          // requests a day, so the extra tokens and the extra second cost
          // nothing worth protecting. Providers that do not support a thinking
          // budget simply ignore it.
          thinkingBudget: ADMIN_THINKING_BUDGET,
          signal: request.signal,
        })) {
          if (event.type === "text") send("text", { text: event.text });
          else if (event.type === "tool") send("tool", { name: event.name });
        }

        if (mutated && path) revalidatePath(path);
        send("done", { changed: mutated });
      } catch (error) {
        if (!request.signal.aborted) {
          const { message } = describeError(error, { audience: "admin" });
          send("error", { message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
