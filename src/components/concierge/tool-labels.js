/**
 * What to show the visitor while a tool runs.
 *
 * Kept here rather than imported from lib/concierge/tools.js because that
 * module is `server-only` — it reaches into the inventory. These are the
 * client-side labels, keyed by tool name.
 */
export const TOOL_LABELS = {
  search_trips: "Checking live departures",
  search_destinations: "Looking through destinations",
  check_departures: "Looking up dates and seats",
  start_booking: "Setting up your booking",
  get_trip: "Reading the itinerary",
  compare_trips: "Comparing trips",
  open_planner: "Preparing the planner",
  hand_to_human: "Bringing in a human",
};
