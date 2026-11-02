import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The connection.
 *
 * Two things here are specific to running Postgres behind a serverless
 * function, and both are the difference between "works on my machine" and
 * "exhausts the connection pool at 200 concurrent requests":
 *
 *   ONE CLIENT PER PROCESS, cached on globalThis. In development Next
 *   re-evaluates modules on every hot reload; without the cache each reload
 *   opens a new pool and the database runs out of connections within an hour
 *   of editing.
 *
 *   max: 1 AND A TRANSACTION POOLER. A serverless function handles one request
 *   at a time, so a pool of ten per instance multiplies to hundreds of idle
 *   connections across instances. Supabase's pooler (port 6543) is what makes
 *   this work; the direct connection (5432) is for migrations only, because
 *   the pooler does not support the session-level statements they need.
 */

const globalForDb = globalThis as unknown as {
  __yaadigoDb?: ReturnType<typeof drizzle<typeof schema>>;
  __yaadigoClient?: ReturnType<typeof postgres>;
};

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/** Why the database cannot be used, in words a developer can act on. */
export function databaseConfigError() {
  if (!process.env.DATABASE_URL) {
    return "DATABASE_URL is not set. Copy the Supabase connection string (the pooled one, port 6543) into .env.local.";
  }
  return null;
}

/** True on Vercel, AWS Lambda and similar per-invocation runtimes. */
function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  const client = postgres(url, {
    /**
     * Pool size.
     *
     * `max: 1` is the right advice for a SERVERLESS FUNCTION, where each
     * invocation is isolated and a pool of ten per instance multiplies into
     * hundreds of idle connections. It is actively wrong for a long-running
     * server: `next start` serves every request from one process, so a single
     * connection serialises them all — and against a database 335ms away that
     * queues requests until they time out. Which is exactly what happened.
     *
     * Detected rather than guessed: Vercel and Lambda both set these.
     */
    max: Number(process.env.DATABASE_POOL_SIZE) || (isServerless() ? 1 : 10),
    idle_timeout: 20,
    connect_timeout: 30,
    // Prepared statements are per connection; a transaction pooler hands out a
    // different backend each time, so they break. This is the single most
    // common cause of "works locally, fails on Vercel".
    prepare: false,
  });

  globalForDb.__yaadigoClient = client;
  return drizzle(client, { schema, casing: "snake_case" });
}

/**
 * The database, or null when it is not configured.
 *
 * Returning null rather than throwing is deliberate: the site's public pages,
 * the AI planner and the content editor all work without a database, and a
 * missing DATABASE_URL should degrade the CRM rather than take the marketing
 * site down with it.
 */
export function getDb() {
  if (!databaseConfigured()) return null;
  globalForDb.__yaadigoDb ??= create()!;
  return globalForDb.__yaadigoDb;
}

/**
 * The database, or a thrown error — for CRM code paths where continuing
 * without persistence would silently lose a lead or a payment.
 */
export function requireDb() {
  const db = getDb();
  if (!db) throw new Error(databaseConfigError() ?? "The database is not available.");
  return db;
}

/**
 * Turn a driver error into something a developer can act on.
 *
 * A misconfigured DATABASE_URL previously surfaced as a bare 500 with the full
 * SQL in the log and the actual cause on the last line. These are the four
 * failures that account for nearly all of it.
 *
 * Deliberately does NOT fall back to the file store. Writing to files while a
 * database exists is split-brain: the two diverge, and whichever is read last
 * silently wins. Failing loudly is the safe answer.
 */
export function describeDbError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error);
  const cause = String((error as { cause?: { message?: string } })?.cause?.message ?? "");
  const text = `${message} ${cause}`;

  if (/password authentication failed|SASL/i.test(text)) {
    return "The database rejected the password. Check DATABASE_URL in .env.local, and percent-encode any @ : / ? # in it. `npm run db:setup` diagnoses this.";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) {
    return "The database host could not be resolved. On Supabase the direct host is IPv6-only — use the pooler hostname instead.";
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENETUNREACH/i.test(text)) {
    return "Could not reach the database. Some networks block 5432; the transaction pooler on 6543 usually works.";
  }
  if (/relation .* does not exist/i.test(text)) {
    return "The tables are missing. Run `npm run db:migrate`.";
  }
  return null;
}

export { schema };
export * from "./schema";
