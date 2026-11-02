#!/usr/bin/env node
/**
 * ai:doctor — which models can this key actually reach?
 *
 * Written after a real failure that cost an afternoon. `gemini-3.8-flash` was
 * configured; the free-tier key could not serve it; and Gemini answers for a
 * model it will not serve you with **503 UNAVAILABLE**, not 404. So the
 * planner said "under heavy load, try again in a few seconds" on every single
 * request, forever, and the message was technically accurate and completely
 * useless.
 *
 * The lesson this script exists to enforce: never assume a model id is
 * available because the version number is higher. Ask, then probe.
 *
 * It lists the models the key advertises, then sends each candidate a real
 * one-token request — because being listed and being servable are different
 * things, which is exactly what bit us.
 */

import { readFileSync } from "node:fs";

// --- Read .env.local without a dependency -----------------------------------
function env() {
  const vars = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      vars[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* No .env.local — fall through to process.env. */
  }
  return { ...vars, ...process.env };
}

const vars = env();
const key = vars.GEMINI_API_KEY || vars.GOOGLE_API_KEY;
const configured = vars.AI_MODEL || "gemini-3.6-flash";

if (!key) {
  console.error("No GEMINI_API_KEY or GOOGLE_API_KEY in .env.local.");
  console.error("Get a free one at https://aistudio.google.com/apikey");
  process.exit(1);
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const headers = { "x-goog-api-key": key, "Content-Type": "application/json" };

console.log(`\nKey  ${key.slice(0, 6)}…${key.slice(-4)}  (${key.length} chars)`);
console.log(`AI_MODEL / preset default: ${configured}\n`);

// --- 1. What does the key advertise? ----------------------------------------
let listed = [];
try {
  const res = await fetch(`${BASE}/models`, { headers });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Listing models failed — HTTP ${res.status}`);
    console.error(body.slice(0, 400));
    if (res.status === 400 || res.status === 403) {
      console.error("\nThat usually means the key is revoked, truncated, or for a different Google API.");
    }
    process.exit(1);
  }
  const data = await res.json();
  listed = (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
} catch (error) {
  console.error(`Could not reach Gemini: ${error.message}`);
  process.exit(1);
}

// Text generation only — image, tts and embedding variants are noise here.
const candidates = listed.filter(
  (m) => /flash|pro/.test(m) && !/image|tts|embed|nano-banana|omni/.test(m)
);

console.log(`${listed.length} models advertised, ${candidates.length} text candidates.\n`);

if (!candidates.includes(configured)) {
  console.log(`!!  "${configured}" is NOT advertised by this key.`);
  console.log("    On Gemini that surfaces as 503 UNAVAILABLE, which reads as");
  console.log("    \"busy, try again\" rather than \"wrong model\". Pick one below.\n");
}

// --- 2. Being listed is not being servable. Probe each one. -----------------
const PROBE = {
  contents: [{ parts: [{ text: "Reply with exactly: ok" }] }],
  generationConfig: { maxOutputTokens: 600 },
};

console.log("Probing (listed and servable are not the same thing):\n");

const working = [];
for (const model of candidates) {
  let line;
  try {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers,
      body: JSON.stringify(PROBE),
    });
    if (res.ok) {
      working.push(model);
      line = "OK";
    } else {
      const body = await res.json().catch(() => ({}));
      const status = body?.error?.status ?? res.status;
      line =
        res.status === 503
          ? `${res.status} ${status} — busy, or not served to this key`
          : `${res.status} ${status}`;
    }
  } catch (error) {
    line = `failed — ${error.message}`;
  }
  console.log(`  ${working.at(-1) === model ? "✓" : "·"} ${model.padEnd(32)} ${line}`);
}

// --- 3. Verdict -------------------------------------------------------------
console.log("");
if (working.length === 0) {
  console.log("Nothing responded. Either the key is exhausted for today, or the");
  console.log("free tier is genuinely saturated. Both resolve without a code change.");
  console.log("\nIf it stays this way, switch provider — the adapter already supports");
  console.log("Groq, Cerebras, Together, Mistral and OpenRouter free tiers:");
  console.log("  AI_PROVIDER=groq  GROQ_API_KEY=…   (console.groq.com/keys)");
  process.exit(1);
}

console.log(`${working.length} model(s) working. Recommended:\n`);
// Prefer full flash over lite — the planner writes long structured itineraries
// and the lite variants drop detail on them — then the highest version among
// those. Ranked rather than first-match, because the API returns models in no
// useful order and the first `gemini-3.x-flash` in the list is not the newest.
function rank(model) {
  const version = Number(model.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const lite = /lite/.test(model) ? 0 : 1;
  const preview = /preview/.test(model) ? 0 : 1;
  return lite * 1000 + preview * 100 + version;
}
const best = [...working].sort((a, b) => rank(b) - rank(a))[0];
console.log(`  AI_MODEL=${best}\n`);

if (configured !== best && !working.includes(configured)) {
  console.log(`Set that in .env.local — "${configured}" is not usable right now.\n`);
} else if (working.includes(configured)) {
  console.log(`Current setting "${configured}" works. Nothing to change.\n`);
}
