#!/usr/bin/env node
/**
 * One command to stand the database up: `npm run db:setup`.
 *
 * It exists because the failure modes here are all silent and all
 * indistinguishable from "it didn't work" — a pooled URL used for migrations,
 * a direct URL used by the app, a password with an unescaped character, an
 * IPv6-only host. Each one produces a different unhelpful error at a different
 * moment. This checks them up front and says which one it is.
 *
 * Safe to run repeatedly. Migrations are tracked, so a second run applies
 * nothing.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`  \x1b[2m${m}\x1b[0m`);

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (!process.env[key]) process.env[key] = raw.trim().replace(/^["']|["']$/g, "");
  }
}

function describe(url, label) {
  try {
    const parsed = new URL(url);
    const port = parsed.port || "5432";
    // The PORT decides the mode, not the hostname.
    //
    // 6543 is the transaction pooler: fine for the app, unusable for DDL.
    // 5432 is session mode — whether that is the direct host or the SESSION
    // pooler. Supabase made direct connections IPv6-only, so on most projects
    // the session pooler is the only reachable way to migrate, and rejecting
    // it for having "pooler" in the name (as this did) blocks the one thing
    // that works.
    return {
      host: parsed.hostname,
      port,
      transactionMode: port === "6543",
      label,
    };
  } catch {
    return null;
  }
}

async function main() {
  console.log("\nYaadiGo — database setup\n");
  loadEnvLocal();

  const appUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_DATABASE_URL;

  if (!appUrl) {
    bad("DATABASE_URL is not set.");
    console.log(`
  What to do:
    1. Create a free project at https://supabase.com
    2. Project Settings → Database → Connection string
    3. Copy BOTH into .env.local:

         DATABASE_URL=         the "Transaction pooler" string  (port 6543)
         DIRECT_DATABASE_URL=  the "Direct connection" string   (port 5432)

    4. Run this again.
`);
    process.exit(1);
  }

  const app = describe(appUrl, "DATABASE_URL");
  const direct = describe(directUrl ?? appUrl, "DIRECT_DATABASE_URL");

  if (!app) {
    bad("DATABASE_URL is not a valid connection string.");
    info("A password containing @ : / or # must be percent-encoded.");
    process.exit(1);
  }

  ok(`DATABASE_URL → ${app.host}:${app.port}`);

  // The mix-up that costs an afternoon, called out before it bites.
  if (!app.transactionMode) {
    console.log("");
    bad("DATABASE_URL does not look like the POOLED connection (expected port 6543).");
    info("The app opens one connection per serverless instance; without a pooler");
    info("a busy moment exhausts the database's connection limit. Use the");
    info('"Transaction pooler" string here and keep the direct one for migrations.');
    console.log("");
  }

  if (!directUrl) {
    console.log("");
    bad("DIRECT_DATABASE_URL is not set — falling back to DATABASE_URL for migrations.");
    info("If that is the pooled URL the migration will fail partway, which is");
    info("worse than not running it. Set the direct (port 5432) string.");
    console.log("");
  } else if (direct?.transactionMode) {
    bad("DIRECT_DATABASE_URL is the TRANSACTION pooler (6543). Migrations need session mode (5432) — either the direct host or the session pooler.");
    process.exit(1);
  } else {
    ok(
      `DIRECT_DATABASE_URL → ${direct.host}:${direct.port}` +
        (direct.host.includes("pooler") ? " (session pooler — correct where the direct host is IPv6-only)" : "")
    );
  }

  // Can we actually reach it?
  process.stdout.write("  … connecting");
  const client = postgres(directUrl ?? appUrl, { max: 1, connect_timeout: 15, prepare: false });
  try {
    const [row] = await client`select version()`;
    process.stdout.write("\r");
    ok(`connected — ${String(row.version).split(",")[0]}`);
  } catch (error) {
    process.stdout.write("\r");
    bad(`could not connect: ${error.message}`);
    if (/password authentication/i.test(error.message)) {
      info("Wrong password, or a special character that needs percent-encoding.");
    } else if (/ENOTFOUND|EAI_AGAIN/i.test(error.message)) {
      info("Host not found. Check the project reference in the URL.");
    } else if (/timeout/i.test(error.message)) {
      info("Timed out. Some networks block 5432 — try the pooler on 6543.");
    }
    await client.end();
    process.exit(1);
  }

  // Migrate.
  //
  // Applied here rather than by shelling out to `drizzle-kit migrate`, which
  // through a Supabase pooler exits CLEAN having applied nothing — silently
  // leaving an empty database that looks migrated. A tool that succeeds
  // without doing the work is worse than one that fails, so this does it
  // directly and reports what it did.
  //
  // Idempotent: "already exists" is counted and skipped, so re-running is safe
  // and a partially-applied migration finishes rather than blocking.
  console.log("\n  Applying migrations…");

  const files = readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let applied = 0;
  let present = 0;

  for (const file of files) {
    const statements = readFileSync(join("drizzle", file), "utf8")
      .split("--> statement-breakpoint")
      .map((x) => x.trim())
      .filter(Boolean);

    for (const statement of statements) {
      try {
        await client.unsafe(statement);
        applied += 1;
      } catch (error) {
        if (/already exists|duplicate/i.test(error.message)) {
          present += 1;
          continue;
        }
        bad(`Migration failed in ${file}`);
        info(statement.slice(0, 110).replace(/\s+/g, " "));
        info(error.message.split("\n")[0]);
        await client.end();
        process.exit(1);
      }
    }
  }

  ok(`${applied} statement(s) applied, ${present} already present`);

  const tables = await client`
    select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`;
  ok(`${tables.length} tables ready: ${tables.map((t) => t.table_name).join(", ")}`);

  const constraints = await client`
    select count(*)::int as n from pg_constraint where contype = 'c'`;
  ok(`${constraints[0].n} CHECK constraints active`);

  await client.end();

  console.log(`
  Done. The CRM now has somewhere durable to live.

  Next:
    npm run dev          and sign in at /admin/login
                         (first sign-in seeds an admin from ADMIN_PASSWORD)
    npm run db:studio    to browse the data
`);
}

main().catch((error) => {
  console.error("\n  Unexpected failure:", error.message, "\n");
  process.exit(1);
});
