// Round-trips planner input through a URL so a plan is shareable and
// re-runnable from a link. Lives outside the "use client" boundary because
// the page decodes on the server and the planner encodes on the client.

export const PLAN_DEFAULTS = {
  destination: "",
  durationDays: 6,
  month: "",
  travellers: 2,
  travelWith: "couple",
  budget: "comfortable",
  pace: "balanced",
  interests: [],
  notes: "",
};

/**
 * Read a length out of free text typed into the ask bar.
 *
 * "Manali 4 days" used to open the planner at the default 6 days with
 * "Manali 4 days" as the destination (review 2026-10-14-full-function-test,
 * F16). Understands "4 days", "4d", "5 nights" (→ 6 days), "5N/6D" and
 * "a week". Returns the destination with the length taken out.
 */
export function parseAsk(text) {
  let destination = String(text ?? "").trim();
  let durationDays = null;

  const take = (pattern, toDays) => {
    if (durationDays !== null) return;
    const match = destination.match(pattern);
    if (!match) return;
    const days = toDays(match);
    if (Number.isFinite(days) && days >= 1) {
      durationDays = Math.min(Math.max(Math.round(days), 1), 21);
      destination = destination.replace(match[0], " ");
    }
  };

  take(/\b(\d{1,2})\s*n\s*\/\s*(\d{1,2})\s*d\b/i, (m) => Number(m[2]));
  take(/\b(\d{1,2})\s*(?:days?|d)\b/i, (m) => Number(m[1]));
  take(/\b(\d{1,2})\s*(?:nights?|n)\b/i, (m) => Number(m[1]) + 1);
  take(/\b(\d)\s*weeks?\b/i, (m) => Number(m[1]) * 7);
  take(/\ba\s+week\b|\bone\s+week\b/i, () => 7);
  take(/\b(?:a\s+)?weekend\b/i, () => 2);

  destination = destination
    .replace(/\s+(?:for|in|of|trip)\s*$/i, "")
    .replace(/^\s*(?:in|to|for|at)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .trim();

  return { destination, durationDays };
}

export function encodeTrip(input) {
  try {
    return btoa(encodeURIComponent(JSON.stringify(input)));
  } catch {
    return null;
  }
}

/**
 * Decodes a `?trip=` value. Anything malformed returns null rather than
 * throwing — a mangled shared link should open the empty form, not a 500.
 * The result is merged over defaults and then re-validated server-side by
 * PlanRequestSchema before it ever reaches the model.
 */
export function decodeTrip(encoded) {
  if (typeof encoded !== "string" || encoded.length > 4000) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(encoded)));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...PLAN_DEFAULTS,
      ...parsed,
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
    };
  } catch {
    return null;
  }
}
