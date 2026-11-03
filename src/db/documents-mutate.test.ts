import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createTestDb } from "./test-db";

/**
 * mutateBy on DOCUMENT collections, against real (in-process) Postgres.
 *
 * Seat counts (`tripOverrides`) are documents written through mutateBy.
 * (Managed trips were too, until they moved to their own table on
 * 2026-11-03: src/db/trips-table.test.ts.) These assert the two
 * things that must hold for that to be safe:
 *
 *   1. the row is found by its key (documents have no `slug` column — the key
 *      lives in `documents.key`), and
 *   2. a partial result MERGES into the stored document rather than replacing
 *      it — the same rule updateRecord already follows.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let repo: typeof import("./repository");

beforeAll(async () => {
  ctx = await createTestDb();
  // getDb() reads this before it would ever open a real connection.
  process.env.DATABASE_URL = "pglite://test";
  (globalThis as { __yaadigoDb?: unknown }).__yaadigoDb = ctx.db;
  repo = await import("./repository");
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

describe("mutateBy on a document collection", () => {
  it("finds an existing document by its key and merges the result", async () => {
    await repo.upsertBy("tripOverrides", "slug", "kashmir-valley-escape", {
      title: "Kashmir, edited",
      published: false,
    });

    await repo.mutateBy("tripOverrides", "slug", "kashmir-valley-escape", async (row) => {
      expect(row?.title).toBe("Kashmir, edited"); // found, not null
      return { departures: [{ id: "a", seatsLeft: 2 }] };
    });

    const rows = (await repo.listRecords("tripOverrides")) ?? [];
    expect(rows).toHaveLength(1); // updated, not a second insert
    expect(rows[0]).toMatchObject({
      slug: "kashmir-valley-escape",
      title: "Kashmir, edited", // survived the partial write
      published: false,
      departures: [{ id: "a", seatsLeft: 2 }],
    });
  });

  it("inserts when there is no document yet, with the key set", async () => {
    await repo.mutateBy("tripOverrides", "slug", "new-trip", async (row) => {
      expect(row).toBeNull();
      return { title: "New trip", published: false };
    });

    await repo.mutateBy("tripOverrides", "slug", "new-trip", async (row) => {
      expect(row?.published).toBe(false); // found by key on the second call
      return { published: true };
    });

    const rows = (await repo.listRecords("tripOverrides")) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: "new-trip", title: "New trip", published: true });
  });

  it("writes nothing when the mutation declines", async () => {
    await repo.upsertBy("tripOverrides", "slug", "goa-beach-weekend", { title: "Goa" });
    await repo.mutateBy("tripOverrides", "slug", "goa-beach-weekend", async () => null);
    const rows = (await repo.listRecords("tripOverrides")) ?? [];
    expect(rows[0]).toMatchObject({ title: "Goa" });
  });
});
