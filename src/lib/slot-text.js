/**
 * Whether a morning / afternoon / evening slot says anything.
 *
 * Itineraries — from the AI planner and the quotation drafter alike — fill
 * an empty slot with a placeholder rather than leaving it blank. On a
 * departure day that printed "Afternoon: Not applicable" and "Evening: Not
 * applicable" in front of a customer. A slot with nothing to say is left out.
 */
const PLACEHOLDER = /^(not applicable|n\/?a|none|nil|-+|—|tbd)?\.?$/i;

export function hasContent(text) {
  if (typeof text !== "string") return false;
  return !PLACEHOLDER.test(text.trim());
}
