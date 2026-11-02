import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Trip management, phase 1 (docs/design/trip-management.md).
 *
 * The lifecycle over the real trips + catalogue code — draft, publish,
 * sales-only, archive with redirect, restore, delete — with storage replaced
 * by an in-memory store that follows the record store's rules (documents
 * merge on update, keyed lookups).
 */

const db = {};
let seq = 0;

vi.mock("@/lib/cms/records", () => {
  const all = (c) => (db[c] ??= []);
  const find = (c, k, v) => all(c).find((r) => r[k] === v) ?? null;
  return {
    listRecords: vi.fn(async (c) => all(c)),
    getRecord: vi.fn(async (c, id) => find(c, "id", id)),
    createRecord: vi.fn(async (c, data) => {
      const row = { id: `${c}_${++seq}`, ...data };
      all(c).push(row);
      return row;
    }),
    updateRecord: vi.fn(async (c, id, patch) => Object.assign(find(c, "id", id) ?? {}, patch)),
    removeRecord: vi.fn(async (c, id) => {
      db[c] = all(c).filter((r) => r.id !== id);
      return true;
    }),
    upsertBy: vi.fn(async (c, k, v, patch) => {
      const row = find(c, k, v);
      if (row) return Object.assign(row, patch);
      const created = { id: `${c}_${++seq}`, [k]: v, ...patch };
      all(c).push(created);
      return created;
    }),
    mutateBy: vi.fn(async (c, k, v, mutate) => {
      const row = find(c, k, v);
      const result = await mutate(row ? { ...row } : null);
      if (!result) return null;
      if (row) return Object.assign(row, result);
      const created = { id: `${c}_${++seq}`, [k]: v, ...result };
      all(c).push(created);
      return created;
    }),
  };
});

vi.mock("@/lib/cms/store", () => ({
  getOverrides: vi.fn(async () => ({ text: {}, image: {}, hidden: {}, style: {} })),
}));

// `getTrips` is wrapped in React's request cache; outside a request that cache
// does not reset between calls, so each test imports a fresh module graph.
async function load() {
  vi.resetModules();
  const trips = await import("./trips");
  const catalogue = await import("./catalogue");
  return { ...trips, ...catalogue };
}

const actor = { id: "u1", name: "Pankaj" };

function complete(content, kind) {
  return {
    ...content,
    destination: "Leh · Nubra",
    summary: "High passes, slowly, with time to acclimatise.",
    days: [{ day: "1", title: "Arrive Leh", detail: "Rest." }],
    inclusions: ["Hotels"],
    ...(kind === "customized" ? { fromPrice: 42000 } : {}),
  };
}

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
});

describe("a brand-new trip", () => {
  it("starts as a draft nobody outside the team can see", async () => {
    const m = await load();
    const { trip } = await m.createTrip({ kind: "group", title: "Ladakh in September", actor });

    expect(trip.slug).toBe("ladakh-in-september");
    expect(trip.status).toBe("draft");
    expect(await m.getTrip(trip.slug)).toBeNull();
    expect(await m.getTrip(trip.slug, { includeUnpublished: true })).toBeNull();
  });

  it("refuses to go live until it is complete enough to sell", async () => {
    const m = await load();
    const { trip } = await m.createTrip({ kind: "group", title: "Ladakh in September", actor });

    const result = await m.publishTrip(trip.slug, { actor });
    expect(result.error).toMatch(/itinerary/i);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it("goes live on Publish, and appears in the catalogue with no departures", async () => {
    let m = await load();
    const { trip } = await m.createTrip({ kind: "group", title: "Ladakh in September", actor });
    const edit = await m.getTripForEdit(trip.slug);
    await m.saveDraft(trip.slug, complete(edit.content, "group"), { actor });
    expect((await m.publishTrip(trip.slug, { actor })).trip.status).toBe("published");

    m = await load();
    const live = await m.getTrip(trip.slug);
    expect(live).toMatchObject({ title: "Ladakh in September", price: 0, departureCount: 0 });
    expect(live.nextDeparture).toBe("Dates coming soon");
    // One version stored, for tracing what was sold.
    expect(db.tripVersions).toHaveLength(1);
  });

  it("can be published to the sales library only — not on the website", async () => {
    let m = await load();
    const { trip } = await m.createTrip({ kind: "customized", title: "Leh with parents", actor });
    const edit = await m.getTripForEdit(trip.slug);
    await m.saveDraft(trip.slug, complete(edit.content, "customized"), { actor });
    await m.publishTrip(trip.slug, { target: "internal", actor });

    m = await load();
    expect(await m.getDestination(trip.slug)).toBeNull();
    expect(await m.getDestination(trip.slug, { includeUnpublished: true })).toMatchObject({
      title: "Leh with parents",
      fromPrice: 42000,
    });
  });

  it("can be deleted while it is still a draft", async () => {
    const m = await load();
    const { trip } = await m.createTrip({ kind: "group", title: "Throwaway", actor });
    expect((await m.deleteDraftTrip(trip.slug)).ok).toBe(true);
    expect(await m.getTripRecord(trip.slug)).toBeNull();
  });

  it("never takes a slug that is already in use", async () => {
    const m = await load();
    const { trip } = await m.createTrip({ kind: "group", title: "Kashmir Valley Escape", actor });
    expect(trip.slug).toBe("kashmir-valley-escape-2");
  });
});

describe("editing a trip that started in code (copy-on-write)", () => {
  const SLUG = "kashmir-valley-escape";

  it("saving a draft does not change the live page", async () => {
    let m = await load();
    const current = await m.getTrip(SLUG, { includeUnpublished: true });
    const edit = await m.getTripForEdit(SLUG, current);
    expect(edit.content.days.length).toBe(7); // seeded from code

    await m.saveDraft(SLUG, { ...edit.content, title: "Kashmir, renamed" }, { actor, current });

    m = await load();
    expect((await m.getTrip(SLUG)).title).toBe("Kashmir Valley Escape");
  });

  it("publishing replaces the page — and keeps the departures and seats", async () => {
    let m = await load();
    const current = await m.getTrip(SLUG, { includeUnpublished: true });
    const edit = await m.getTripForEdit(SLUG, current);
    await m.saveDraft(SLUG, { ...edit.content, title: "Kashmir, renamed" }, { actor, current });
    await m.publishTrip(SLUG, { actor, current });

    m = await load();
    const live = await m.getTrip(SLUG);
    expect(live.title).toBe("Kashmir, renamed");
    expect(live.itinerary).toHaveLength(7);
    expect(live.departures).toHaveLength(current.departures.length);
    expect(live.departures[0].seatsLeft).toBe(current.departures[0].seatsLeft);
  });

  it("cannot be deleted — only archived", async () => {
    const m = await load();
    const current = await m.getTrip(SLUG, { includeUnpublished: true });
    await m.saveDraft(SLUG, (await m.getTripForEdit(SLUG, current)).content, { actor, current });
    expect((await m.deleteDraftTrip(SLUG)).error).toMatch(/Archive it instead/);
  });
});

describe("archive and restore", () => {
  const SLUG = "goa-beach-weekend";

  it("takes the trip off the site and forwards its URL", async () => {
    let m = await load();
    const current = await m.getTrip(SLUG, { includeUnpublished: true });
    const result = await m.archiveTrip(SLUG, { redirectTo: "/group-tours/kashmir-valley-escape", actor, current });
    expect(result.trip.status).toBe("archived");

    m = await load();
    expect(await m.getTrip(SLUG)).toBeNull();
    expect(await m.redirectFor(SLUG)).toBe("/group-tours/kashmir-valley-escape");
    // Still reachable for bookings that need to release seats.
    expect(await m.getTrip(SLUG, { includeUnpublished: true })).not.toBeNull();
  });

  it("refuses to redirect off-site or to itself", async () => {
    const m = await load();
    const current = await m.getTrip(SLUG, { includeUnpublished: true });
    expect((await m.archiveTrip(SLUG, { redirectTo: "https://evil.example", actor, current })).error).toBeTruthy();
    expect((await m.archiveTrip(SLUG, { redirectTo: `/group-tours/${SLUG}`, actor, current })).error).toBeTruthy();
  });

  it("restores as sales-only, so it does not reappear on the site by surprise", async () => {
    let m = await load();
    const current = await m.getTrip(SLUG, { includeUnpublished: true });
    await m.archiveTrip(SLUG, { actor, current });
    expect((await m.restoreTrip(SLUG, { actor })).trip.status).toBe("internal");

    m = await load();
    expect(await m.getTrip(SLUG)).toBeNull();
    expect(await m.redirectFor(SLUG)).toBeNull();
  });

  it("an archived trip cannot be edited", async () => {
    const m = await load();
    const current = await m.getTrip(SLUG, { includeUnpublished: true });
    await m.archiveTrip(SLUG, { actor, current });
    const result = await m.saveDraft(SLUG, (await m.getTripForEdit(SLUG, current)).content, { actor });
    expect(result.error).toMatch(/archived/);
  });
});

describe("duplicate", () => {
  it("copies the content into a new draft with its own slug", async () => {
    const m = await load();
    const current = await m.getDestination("golden-triangle-classic", { includeUnpublished: true });
    const { trip } = await m.duplicateTrip("golden-triangle-classic", { actor, current });
    expect(trip.status).toBe("draft");
    expect(trip.kind).toBe("customized");
    expect(trip.draft.title).toBe("Golden Triangle, Unhurried (copy)");
    expect(trip.slug).not.toBe("golden-triangle-classic");
  });
});
