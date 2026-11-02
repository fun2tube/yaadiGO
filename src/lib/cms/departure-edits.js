/**
 * Apply a trip editor's changes to a trip's departures.
 *
 * Since phase 2 the editor sets a batch's SIZE (`capacity`), never its seats
 * left — those are derived from bookings and holds (lib/inventory.js). That
 * removes the old failure outright (#130: a stale "seats left" written back
 * over a booking), because there is no seat count to write.
 *
 * What still needs guarding:
 *   - a batch cannot shrink below the travellers already booked or held on it
 *   - a batch with anyone booked or held on it cannot be deleted
 *   - closed / cancelled are set by their own actions, not by this save, so a
 *     stale editor cannot quietly reopen a batch the desk just closed
 *
 * Pure — the caller runs it inside the trip's lock with live states.
 *
 * @param {Array} live    departures as stored now (capacity explicit)
 * @param {Array} edits   departures from the editor
 * @param {Array} states  departureState() of each live batch
 * @returns {{ departures: Array } | { error: string }}
 */
export function mergeDepartureEdits(live, edits, states = []) {
  const byId = new Map(live.map((d) => [d.id, d]));
  const stateOf = new Map(states.map((s) => [s.id, s]));
  const editedIds = new Set(edits.map((d) => d.id));
  const committed = (id) => (stateOf.get(id)?.booked ?? 0) + (stateOf.get(id)?.held ?? 0);

  for (const gone of live) {
    if (editedIds.has(gone.id)) continue;
    const people = committed(gone.id);
    if (people > 0) {
      return {
        error: `${people} traveller${people === 1 ? " is" : "s are"} booked or held on the ${gone.start} batch. Move or cancel them before removing it.`,
      };
    }
  }

  // One batch per start date per trip — the `departures` table enforces it,
  // and two identical dates are always a typing mistake.
  const starts = new Set();
  for (const edit of edits) {
    if (edit.end <= edit.start) return { error: `The ${edit.start} batch ends before it starts.` };
    if (starts.has(edit.start)) return { error: `Two batches start on ${edit.start}. Change one of them.` };
    starts.add(edit.start);
  }

  const departures = [];
  for (const edit of edits) {
    const current = byId.get(edit.id);
    const people = current ? committed(edit.id) : 0;

    if (edit.capacity < people) {
      return {
        error: `${people} seat${people === 1 ? " is" : "s are"} already booked or held on the ${edit.start} batch — it cannot be smaller than that.`,
      };
    }

    departures.push({
      id: edit.id,
      start: edit.start,
      end: edit.end,
      price: edit.price,
      capacity: edit.capacity,
      minToRun: edit.minToRun ?? current?.minToRun ?? 0,
      ...(edit.cutoffDays != null ? { cutoffDays: edit.cutoffDays } : current?.cutoffDays != null ? { cutoffDays: current.cutoffDays } : {}),
      // Owned by the board's Close / Cancel actions, never by this save.
      ...(current?.closed ? { closed: true } : {}),
      ...(current?.cancelled ? { cancelled: true } : {}),
    });
  }

  return { departures };
}
