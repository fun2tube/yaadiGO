import "server-only";

import { PRESETS, PRESET_NAMES, customPreset } from "@/lib/ai/presets";
import { createGemini } from "@/lib/ai/providers/gemini";
import { createOpenAICompatible } from "@/lib/ai/providers/openai-compatible";

/**
 * The single place the AI provider is named.
 *
 * The planner, Yaadi and the admin agent talk to a provider object with four
 * methods — streamJson, generateJson, streamWithTools, describeApiError — and
 * nothing above this file knows which service is behind it. That boundary is
 * what makes AI_PROVIDER a one-line switch between Gemini, any free tier
 * serving open-weight models, and a self-hosted vLLM or Ollama box.
 *
 * These are public, unauthenticated endpoints that cost something on every
 * request, so everything protective lives here rather than being re-derived in
 * each route.
 */

const PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();

/**
 * Thinking is off for the visitor-facing features and on for the admin agent.
 *
 * The planner and Yaadi are neither reasoning problems — an itinerary is
 * structured writing, and a concierge that deliberates for twenty seconds
 * before saying "yes, October is fine" is a worse concierge. The admin agent
 * WRITES to the live site and runs a few times a day, so accuracy beats
 * latency there: with thinking off, Flash invented an off-brand homepage
 * heading and saved it. Only Gemini reads these.
 */
export const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
export const ADMIN_THINKING_BUDGET = Number(process.env.GEMINI_ADMIN_THINKING_BUDGET ?? -1);

function resolvePreset() {
  if (PRESETS[PROVIDER]) return { name: PROVIDER, ...PRESETS[PROVIDER] };
  if (process.env.AI_BASE_URL) {
    return { name: PROVIDER, ...customPreset(process.env.AI_BASE_URL) };
  }
  console.error(
    `[ai] AI_PROVIDER="${PROVIDER}" is not one of ${PRESET_NAMES.join(", ")}, and no AI_BASE_URL is set.`
  );
  return null;
}

function findKey(preset) {
  for (const name of preset.keyEnv) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

let provider;
let builtFor;

/**
 * Lazily constructed so a missing key is a handled 503, not a boot crash.
 *
 * Rebuilt whenever the configuration changes, because `next dev` reloads
 * .env.local into a running process — a cached client would otherwise keep
 * using whatever the server started with, which looks exactly like an edit
 * that did nothing.
 */
export function getProvider() {
  const preset = resolvePreset();
  if (!preset) return null;

  const apiKey = findKey(preset);
  // A self-hosted endpoint legitimately has no key.
  if (!apiKey && !preset.selfHosted) return null;

  const model = process.env.AI_MODEL || preset.model;
  if (!model) {
    console.error(`[ai] no model set. Give AI_MODEL a value for ${preset.label}.`);
    return null;
  }

  const baseUrl = process.env.AI_BASE_URL || preset.baseUrl;
  const signature = `${preset.name}|${baseUrl}|${model}|${apiKey ?? ""}`;

  if (!provider || builtFor !== signature) {
    provider =
      preset.kind === "gemini"
        ? createGemini({
            apiKey,
            model,
            thinkingBudget: THINKING_BUDGET,
            adminThinkingBudget: ADMIN_THINKING_BUDGET,
          })
        : createOpenAICompatible({
            id: preset.name,
            label: preset.label,
            baseUrl,
            apiKey,
            model,
            strictJson: preset.strictJson,
          });
    builtFor = signature;
  }
  return provider;
}

/** What the visitor-facing copy should call the thing that is unavailable. */
export function providerInfo() {
  const preset = resolvePreset();
  return {
    name: preset?.name ?? PROVIDER,
    label: preset?.label ?? PROVIDER,
    keyEnv: preset?.keyEnv?.[0] ?? "AI_API_KEY",
    signup: preset?.signup,
    model: process.env.AI_MODEL || preset?.model || "(unset)",
    selfHosted: Boolean(preset?.selfHosted),
  };
}

export class PlannerUnavailableError extends Error {
  constructor() {
    super("The trip planner is not configured on this server.");
    this.name = "PlannerUnavailableError";
    this.status = 503;
  }
}

export class RateLimitedError extends Error {
  constructor(retryAfterSeconds) {
    super("Too many requests.");
    this.name = "RateLimitedError";
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting
//
// In-memory, therefore PER SERVER INSTANCE: it stops one browser hammering
// the endpoint, which is the realistic abuse here, but it does not survive a
// restart and does not coordinate across instances. If the planner ever gets
// real traffic across several instances, move this to Redis/Upstash — the
// interface below is what you would swap.
// ---------------------------------------------------------------------------

const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();

function sweep(now) {
  for (const [key, times] of hits) {
    const live = times.filter((t) => now - t < WINDOW_MS);
    if (live.length) hits.set(key, live);
    else hits.delete(key);
  }
}

/**
 * @param {Request} request
 * @param {string} bucket  separate allowances for separate costs
 * @param {number} limit   requests per hour
 */
export function enforceRateLimit(request, bucket, limit) {
  const now = Date.now();
  if (hits.size > 500) sweep(now);

  // `x-forwarded-for` is only trustworthy behind a proxy that sets it
  // (Vercel does). Direct-to-Node deployments should put this behind one.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const key = `${bucket}:${ip}`;
  const times = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (times.length >= limit) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - times[0])) / 1000);
    throw new RateLimitedError(retryAfter);
  }

  times.push(now);
  hits.set(key, times);
}

const dev = () => process.env.NODE_ENV !== "production";

/** Maps a provider error onto something safe to show a visitor. */
export function describeError(error, { audience = "visitor" } = {}) {
  if (error instanceof RateLimitedError) {
    return {
      status: 429,
      message: `You've generated a lot of plans in the last hour. Try again in ${Math.ceil(
        error.retryAfterSeconds / 60
      )} minutes, or send what you have to the travel desk.`,
    };
  }

  // Every model on the ladder was silent (providers/gemini.js). The message is
  // already written for the person waiting — say it as it is.
  if (error?.code === "AI_TIMEOUT") {
    return { status: 504, message: error.message };
  }

  const info = providerInfo();

  if (error instanceof PlannerUnavailableError) {
    // In development, say the actual cause. The polite visitor-facing wording
    // below reads like a product decision rather than a missing environment
    // variable, which is exactly how this gets mistaken for a broken feature.
    if (dev()) {
      console.error(
        [
          "",
          `[ai] ${info.keyEnv} is not set (AI_PROVIDER=${info.name}).`,
          "     The AI planner, Yaadi and the admin agent cannot work without it.",
          "",
          info.signup ? `     Get a key at ${info.signup}` : "",
          "     Then add it to .env.local. The dev server picks it up on its own.",
          "",
          `     Or switch provider: AI_PROVIDER=${PRESET_NAMES.join(" | ")}`,
          "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return {
        status: 503,
        message: `Developer: ${info.keyEnv} is not set (AI_PROVIDER=${info.name}). Add it to .env.local${
          info.signup ? ` — get one at ${info.signup}` : ""
        }. No restart needed. (Visitors see a polite fallback instead of this.)`,
      };
    }
    if (audience === "admin") {
      return {
        status: 503,
        message: `The AI assistant needs ${info.keyEnv} set on the server. Manual editing still works.`,
      };
    }
    return {
      status: 503,
      message:
        "The trip planner isn't switched on yet. Tell us what you're planning and a travel expert will reply personally.",
    };
  }

  // Both adapters reduce their own SDK's error to { status, text, provider },
  // so everything below is written once rather than per provider.
  const api = getProvider()?.describeApiError(error) ?? null;

  if (api) {
    const { status, text } = api;
    console.error(`[ai] ${info.label} error`, status, text);

    // A 429 on a free tier is a QUOTA problem, not a busy server, and the two
    // want opposite advice: "try again in a minute" is right for a burst and
    // actively wrong for a daily cap that will not reset until tomorrow.
    if (status === 429) {
      const daily = /per day|daily|PerDay|quota/i.test(text) && !/per minute|rate limit/i.test(text);
      if (dev()) {
        return {
          status: 429,
          message: `Developer: ${info.label} quota exhausted (${
            daily ? "daily limit" : "per-minute limit"
          }). ${
            daily ? "It resets on the provider's daily cycle, or enable billing." : "Wait a minute and retry."
          } (Visitors see a polite fallback instead of this.)`,
        };
      }
      return {
        status: 429,
        message: daily
          ? "The planner has hit today's limit. Tell us what you're planning and a travel expert will reply personally."
          : "The planner is busy right now. Try again in a minute.",
      };
    }

    // Free-tier capacity, not our mistake — the model is simply busy for a few
    // seconds. "Couldn't finish that" reads like the request was bad and
    // invites the visitor to rewrite a perfectly good one.
    if (status === 503 || status === 502 || status === 529) {
      // A model the key cannot serve returns 503 UNAVAILABLE on Gemini, not
      // 404 — so "busy, try again" was indistinguishable from "this will never
      // work", and the planner repeated it forever. In development, name the
      // model and say how to check it; that is the difference between a
      // five-minute fix and an afternoon.
      if (dev()) {
        return {
          status: 503,
          message: `Developer: ${info.label} returned 503 for "${info.model}". That means busy OR that this key cannot serve that model — the two are indistinguishable here. Run \`npm run ai:doctor\` to list the models this key CAN reach, and set AI_MODEL to one of them. (Visitors see a polite fallback instead of this.)`,
        };
      }
      return {
        status: 503,
        // Deliberately does NOT promise that nothing was saved. The agent
        // applies each tool as it goes, so a failure part-way through leaves
        // whatever it had already done in place — telling an editor their
        // change was discarded, when half of it is live, is worse than the
        // error itself.
        message:
          audience === "admin"
            ? `${info.label} is under heavy load. Send that again in a few seconds — anything it had already changed is saved.`
            : "The planner is under heavy load right now. Give it a few seconds and try again.",
      };
    }

    // A rejected key is our problem, never the visitor's — but in development
    // it must be said out loud. A key that is present but wrong (truncated
    // paste, revoked, restricted to a different API) is at least as common as
    // a missing one, and it used to surface as the same "temporarily
    // unavailable" a visitor sees, which reads like an outage.
    if (status === 401 || status === 403) {
      if (dev()) {
        return {
          status: 503,
          message: `Developer: ${info.keyEnv} was rejected by ${info.label}. Check for a truncated paste, a revoked key, or a key for a different service. (Visitors see a polite fallback instead of this.)`,
        };
      }
      return { status: 503, message: "The trip planner is temporarily unavailable." };
    }

    // A wrong model name is a configuration mistake that otherwise reads as a
    // broken feature. Worth its own message because AI_MODEL is meant to be
    // changed, and model ids on these services are retired on a schedule.
    if (status === 404) {
      if (dev()) {
        return {
          status: 502,
          message: `Developer: ${info.label} does not serve the model "${info.model}". Set AI_MODEL in .env.local to one it does. (Visitors see a polite fallback instead of this.)`,
        };
      }
      return { status: 502, message: "The planner couldn't finish that. Please try again." };
    }

    // A 400 is never the visitor's fault — the request we built was wrong,
    // which in practice means a configuration problem. "Please try again"
    // sends a developer chasing a phantom outage, so in development the
    // provider's own explanation is passed through.
    if (status === 400 && dev()) {
      return {
        status: 502,
        message: `Developer: ${info.label} rejected the request — ${text} (Visitors see a polite fallback instead of this.)`,
      };
    }

    return { status: 502, message: "The planner couldn't finish that. Please try again." };
  }

  // A self-hosted endpoint that is simply not running is the most common
  // failure for ollama/vllm, and "something went wrong" hides it completely.
  if (info.selfHosted && /ECONNREFUSED|fetch failed/i.test(String(error?.message ?? ""))) {
    console.error(`[ai] could not reach ${info.label} — is it running?`);
    if (dev()) {
      return {
        status: 503,
        message: `Developer: nothing is listening at AI_BASE_URL. Start ${info.label} and try again. (Visitors see a polite fallback instead of this.)`,
      };
    }
    return { status: 503, message: "The trip planner is temporarily unavailable." };
  }

  console.error("[ai] unexpected error", error);
  return { status: 500, message: "Something went wrong generating that plan." };
}
