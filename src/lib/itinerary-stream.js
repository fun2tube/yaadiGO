/**
 * Pulls complete objects out of a JSON document while it is still being
 * written.
 *
 * Structured outputs emit properties in schema order, so an itinerary arrives
 * as: header scalars, then `"days":[ {...}, {...} ]`, then the trailing
 * arrays. That lets us show the traveller the trip summary almost immediately
 * and then one day card at a time, instead of a spinner until the whole
 * document lands.
 *
 * The scanner tracks string and escape state so a `{` inside a value — "the
 * café {closed Mondays}" — never miscounts depth, and it keeps its position
 * between chunks so each character is examined exactly once.
 */
export function createItineraryExtractor() {
  let buffer = "";

  // Phase 1: looking for the start of the days array.
  let daysArrayStart = -1;
  let headerEmitted = false;

  // Phase 2: walking the days array.
  let cursor = 0;
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let emittedDays = 0;

  /** Locate `"days"` followed by its opening bracket. */
  function findDaysArray() {
    const key = buffer.indexOf('"days"');
    if (key === -1) return false;
    const bracket = buffer.indexOf("[", key);
    if (bracket === -1) return false;
    daysArrayStart = bracket + 1;
    cursor = daysArrayStart;
    return true;
  }

  /**
   * Everything before `"days"` is a complete set of scalar properties; closing
   * it with `}` gives valid JSON we can parse for the header.
   */
  function parseHeader() {
    const key = buffer.indexOf('"days"');
    if (key === -1) return null;
    let head = buffer.slice(0, key).trimEnd();
    if (head.endsWith(",")) head = head.slice(0, -1);
    try {
      return JSON.parse(`${head}}`);
    } catch {
      return null;
    }
  }

  return {
    /**
     * Feed the next chunk of model output.
     * @returns {{header?: object, days: object[]}} whatever became complete.
     */
    push(chunk) {
      buffer += chunk;
      const out = { days: [] };

      if (daysArrayStart === -1 && !findDaysArray()) return out;

      if (!headerEmitted) {
        const header = parseHeader();
        if (header) {
          headerEmitted = true;
          out.header = header;
        }
      }

      for (; cursor < buffer.length; cursor++) {
        const ch = buffer[cursor];

        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          if (inString) escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === "{") {
          if (depth === 0) objectStart = cursor;
          depth++;
          continue;
        }
        if (ch === "}") {
          depth--;
          if (depth === 0 && objectStart !== -1) {
            const slice = buffer.slice(objectStart, cursor + 1);
            objectStart = -1;
            try {
              const day = JSON.parse(slice);
              emittedDays++;
              out.days.push(day);
            } catch {
              // A day we cannot parse is dropped rather than shown broken;
              // finish() re-parses the whole document and recovers it.
            }
          }
          continue;
        }
        // `]` at depth 0 ends the days array; the tail is handled by finish().
        if (ch === "]" && depth === 0) {
          cursor = buffer.length;
          break;
        }
      }

      return out;
    },

    /**
     * Parse the finished document. This is the authoritative result — the
     * streamed pieces above are a preview, and anything they dropped or got
     * half-formed is corrected here.
     */
    finish() {
      try {
        return JSON.parse(buffer);
      } catch {
        return null;
      }
    },

    get raw() {
      return buffer;
    },

    get count() {
      return emittedDays;
    },
  };
}
