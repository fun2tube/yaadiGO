import { readFileSync, existsSync } from "node:fs";
import type { Config } from "drizzle-kit";

/**
 * drizzle-kit reads process.env directly and does NOT load .env.local, so the
 * config loads it itself. Without this, `npm run db:migrate` run on its own
 * fails with an empty url — which reads as a broken tool rather than a missing
 * file.
 */
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

/**
 * Migrations need SESSION mode (port 5432) — either the direct host or the
 * session pooler. A transaction pooler cannot run the session-level statements
 * DDL needs, and the failure mode is a migration that half-applies.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
