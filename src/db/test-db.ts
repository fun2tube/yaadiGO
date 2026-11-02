import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";

/**
 * A real Postgres, in-process.
 *
 * PGlite is Postgres compiled to WebAssembly, so the tests run against the
 * actual engine — the same CHECK constraints, the same transaction semantics,
 * the same row-level behaviour — with no Docker, no container, no credentials
 * and no shared test database to leave dirty.
 *
 * This matters more than it sounds. Mocking the database would have let every
 * claim in the schema go unchecked: a CHECK constraint that is never exercised
 * is a comment, and "the second writer's WHERE fails" is a theory until
 * Postgres actually refuses the row.
 *
 * The migration applied here is the SAME SQL file drizzle-kit generates and
 * ships to production. If a constraint is missing from the migration, these
 * tests fail — which is the point.
 */

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: "snake_case" });

  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    // drizzle-kit separates statements with this marker. Splitting on plain
    // semicolons would break every function body and quoted string.
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }

  /**
   * Empty every table without dropping them.
   *
   * Far cheaper than rebuilding the database per test — booting WASM Postgres
   * and replaying the migrations takes seconds, and doing it a dozen times per
   * file was enough to blow the hook timeout. RESTART IDENTITY and CASCADE
   * keep sequences and foreign keys honest, so a truncated database behaves
   * exactly like a fresh one.
   */
  async function reset() {
    const rows = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'"
    );
    const names = rows.rows
      .map((r) => `"${r.tablename}"`)
      .filter((n) => !n.includes("__drizzle"));
    if (names.length === 0) return;
    await client.exec(`truncate ${names.join(", ")} restart identity cascade`);
  }

  return { db, client, reset, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>["db"];
