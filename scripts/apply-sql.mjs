#!/usr/bin/env node
/**
 * Apply one migration file and say what it did.
 *
 * `drizzle-kit migrate` has burned this project once already: through a
 * Supabase pooler it created its own bookkeeping schema, applied zero
 * statements and exited 0, leaving an empty database reported as migrated. A
 * tool that succeeds without doing the work is worse than one that fails, so
 * this runs the statements itself and prints what landed.
 *
 *   node scripts/apply-sql.mjs drizzle/0002_whatever.sql
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";

const vars = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

// DDL needs a session connection (5432), not the transaction pooler (6543).
const url = vars.DIRECT_DATABASE_URL || vars.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_DATABASE_URL or DATABASE_URL in .env.local");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-sql.mjs <file.sql>");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 30 });

try {
  const statements = readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`${statements.length} statement(s) from ${file}\n`);

  for (const statement of statements) {
    const label = statement.replace(/\s+/g, " ").slice(0, 76);
    try {
      await sql.unsafe(statement);
      console.log(`  applied  ${label}…`);
    } catch (error) {
      // Re-running after a partial failure is normal, so "already exists" is a
      // skip rather than a failure.
      if (/already exists|duplicate/i.test(error.message)) {
        console.log(`  skipped  ${label}… (already there)`);
      } else {
        throw error;
      }
    }
  }

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  console.log(`\n${tables.length} tables: ${tables.map((t) => t.table_name).join(", ")}`);
} catch (error) {
  console.error("\nfailed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
