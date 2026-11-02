import "server-only";

import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import * as pg from "@/db/repository";

/**
 * A tiny record store for the admin's collections.
 *
 * Same adapter shape as lib/cms/store.js and the same reasoning: one JSON file
 * per collection, read fresh on every call. No module-level cache, because
 * `next start` runs several worker processes and a per-process cache means a
 * write in worker A is invisible to workers B and C — which looks exactly like
 * a save that silently did nothing.
 *
 * Writes are serialised per collection with a promise chain. Two requests
 * landing together (a lead arriving while staff change its status) would
 * otherwise both read, both mutate their own copy, and the second write would
 * erase the first.
 *
 * POSTGRES IS NOW THE REAL STORE. When DATABASE_URL is set every call below
 * delegates to db/repository.ts and the JSON files are not touched. Without it
 * the file store still runs, so the marketing site, the AI planner and the
 * content editor keep working on a machine with no database — the CRM degrades
 * alone rather than taking the site down with it.
 *
 * The file path is scaffolding with a deletion date: once Supabase is live it
 * goes, and `storageIsDurable()` is what the admin reads to warn that it is
 * still in use.
 */

const DIR = path.join(process.cwd(), "content");
const EPHEMERAL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const queues = new Map();

function file(collection) {
  return path.join(DIR, `${collection}.json`);
}

async function read(collection) {
  try {
    const parsed = JSON.parse(await fs.readFile(file(collection), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`[cms] could not read ${collection}:`, error.message);
    }
    return [];
  }
}

async function write(collection, rows) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file(collection), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  return rows;
}

/** Read-modify-write, one at a time per collection. */
function serialise(collection, task) {
  const previous = queues.get(collection) ?? Promise.resolve();
  const next = previous.then(task, task);
  // Keep the chain alive even if a task rejects, or every later write hangs.
  queues.set(
    collection,
    next.catch(() => {})
  );
  return next;
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

export async function listRecords(collection) {
  const rows = await pg.listRecords(collection);
  return rows ?? read(collection);
}

export async function getRecord(collection, id) {
  if (pg.storageIsDurable() && pg.isMapped(collection)) {
    return pg.getRecord(collection, id);
  }
  return (await read(collection)).find((row) => row.id === id) ?? null;
}

export async function createRecord(collection, record) {
  if (pg.storageIsDurable() && pg.isMapped(collection)) {
    return pg.createRecord(collection, {
      ...record,
      createdAt: record.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
  }
  return serialise(collection, async () => {
    const rows = await read(collection);
    const row = {
      ...record,
      id: record.id ?? newId(collection.slice(0, 4)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Newest first: an inbox is read from the top.
    await write(collection, [row, ...rows]);
    return row;
  });
}

export async function updateRecord(collection, id, patch) {
  if (pg.storageIsDurable() && pg.isMapped(collection)) {
    return pg.updateRecord(collection, id, patch);
  }
  return serialise(collection, async () => {
    const rows = await read(collection);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return null;
    rows[index] = { ...rows[index], ...patch, id, updatedAt: new Date().toISOString() };
    await write(collection, rows);
    return rows[index];
  });
}

export async function removeRecord(collection, id) {
  if (pg.storageIsDurable() && pg.isMapped(collection)) {
    return pg.removeRecord(collection, id);
  }
  return serialise(collection, async () => {
    const rows = await read(collection);
    const next = rows.filter((row) => row.id !== id);
    if (next.length === rows.length) return false;
    await write(collection, next);
    return true;
  });
}

/**
 * Upsert keyed by something other than id — used for trip and destination
 * overrides, which are keyed by slug so they survive a record being recreated.
 */
export async function upsertBy(collection, key, value, patch) {
  if (pg.storageIsDurable() && pg.isMapped(collection)) {
    return pg.upsertBy(collection, key, value, patch);
  }
  return serialise(collection, async () => {
    const rows = await read(collection);
    const index = rows.findIndex((row) => row[key] === value);
    const now = new Date().toISOString();

    if (index === -1) {
      const row = {
        id: newId(collection.slice(0, 4)),
        [key]: value,
        ...patch,
        createdAt: now,
        updatedAt: now,
      };
      await write(collection, [...rows, row]);
      return row;
    }

    rows[index] = { ...rows[index], ...patch, updatedAt: now };
    await write(collection, rows);
    return rows[index];
  });
}

/**
 * Read-modify-write a single keyed row inside the serialised chain.
 *
 * `upsertBy` is enough when the new values do not depend on the old ones.
 * Seat accounting does depend on them — two confirmations landing together
 * would each read "6 seats left", each write "4", and the batch would be
 * oversold by two. `mutate` runs the caller's function between the read and
 * the write, so the second confirmation sees the first one's result.
 *
 * `mutate(row | null)` returns the row to store, or null to leave the
 * collection untouched (used to reject a change, e.g. not enough seats).
 */
export async function mutateBy(collection, key, value, mutate) {
  if (pg.storageIsDurable() && pg.isMapped(collection)) {
    return pg.mutateBy(collection, key, value, mutate);
  }
  return serialise(collection, async () => {
    const rows = await read(collection);
    const index = rows.findIndex((row) => row[key] === value);
    const current = index === -1 ? null : rows[index];

    const result = await mutate(current);
    if (!result) return null;

    const now = new Date().toISOString();
    const row =
      index === -1
        ? { id: newId(collection.slice(0, 4)), [key]: value, ...result, createdAt: now, updatedAt: now }
        : { ...current, ...result, [key]: value, updatedAt: now };

    if (index === -1) await write(collection, [...rows, row]);
    else {
      rows[index] = row;
      await write(collection, rows);
    }
    return row;
  });
}

export function storageIsDurable() {
  // Postgres survives a deploy. A JSON file on a serverless host does not.
  if (pg.storageIsDurable()) return true;
  return !EPHEMERAL;
}
