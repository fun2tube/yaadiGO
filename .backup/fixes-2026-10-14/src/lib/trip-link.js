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
