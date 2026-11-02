// `next dev` against the local file store instead of Postgres.
//
// For working on the site when the database is unreachable or slow. Starts
// Next with DATABASE_URL present-but-EMPTY: @next/env never overrides a key
// that already exists, so .env.local's value is ignored and every module that
// checks `databaseConfigured()` falls back to content/*.json.
//
//   node scripts/dev-local-store.mjs          (port 3006)
//   node scripts/dev-local-store.mjs 3010
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] ?? "3006";
const env = { ...process.env, DATABASE_URL: "", DIRECT_DATABASE_URL: "" };

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-p", port],
  { cwd: root, env, stdio: "inherit" }
);
child.on("exit", (code) => process.exit(code ?? 0));
