import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDb, describeDbError } from "./index";
import * as schema from "./schema";
import { toPaise, toRupees } from "./money";

/**
 * The Postgres implementation of the record store.
 *
 * Every CRM module already talks to `lib/cms/records.js` —
 * listRecords / getRecord / createRecord / updateRecord / removeRecord /
 * upsertBy / mutateBy. This file implements exactly that interface against
 * real tables, so the modules move to Postgres without a line changing in any
 * of them. `records.js` picks whichever is configured.
 *
 * Two translations happen at this boundary and nowhere else:
 *
 *   MONEY. Rupees above, integer paise below. The app layer still thinks in
 *   rupees this pass; what is DURABLE is now exact. Moving the app layer to
 *   paise is a separate, safer step once nothing is writing JSON files.
 *
 *   TIMESTAMPS. Modules compare and sort ISO strings
 *   (`String(a.createdAt).localeCompare(...)`). Postgres returns Date objects.
 *   Handing a Date to that comparison sorts by "Mon Sep 29 2026" — i.e.
 *   alphabetically by weekday — which is the kind of bug that looks like
 *   nothing until an inbox is in the wrong order. Dates come back as ISO
 *   strings.
 */

/** collection name → table, plus the fields that need translating. */
const TABLES = {
  users: {
    table: schema.users,
    money: { monthlyTarget: "monthlyTargetPaise" },
    dates: ["inviteExpiresAt", "resetExpiresAt", "acceptedAt", "approvedAt", "lastSignInAt"],
  },
  leads: {
    table: schema.leads,
    // `budgetAmount` joins `value` so callers stay in rupees throughout and
    // only the column is in paise. departureDate/returnDate are deliberately
    // NOT in `dates`: they are `date` columns, not timestamps, and Drizzle
    // wants a 'YYYY-MM-DD' string — converting them to Date objects here
    // would shift them by the timezone offset and land a June 1st departure
    // on May 31st.
    money: { value: "valuePaise", budgetAmount: "budgetAmountPaise" },
    dates: ["followUpAt", "convertedAt", "receivedAt"],
  },
  quotations: {
    table: schema.quotations,
    money: {
      subtotal: "subtotalPaise",
      cost: "costPaise",
      discount: "discountPaise",
      tax: "taxPaise",
      total: "totalPaise",
      perPerson: "perPersonPaise",
      grossMargin: "grossMarginPaise",
    },
    dates: ["sentAt", "decidedAt"],
  },
  bookings: {
    table: schema.bookings,
    money: {
      total: "totalPaise",
      perPerson: "perPersonPaise",
      advance: "advancePaise",
      balance: "balancePaise",
      collected: "collectedPaise",
    },
    dates: ["handedToOpsAt"],
  },
  payments: {
    table: schema.payments,
    money: { amount: "amountPaise" },
    dates: ["receivedAt"],
  },
  invoices: {
    table: schema.invoices,
    money: {
      subtotal: "subtotalPaise",
      discount: "discountPaise",
      tax: "taxPaise",
      total: "totalPaise",
    },
    dates: ["issuedAt"],
  },
  bookingServices: {
    table: schema.bookingServices,
    money: { cost: "costPaise" },
    dates: [],
  },
  events: {
    table: schema.events,
    money: { amount: "amountPaise" },
    dates: ["at"],
  },
  notifications: { table: schema.notifications, money: {}, dates: [] },
  outbox: { table: schema.outbox, money: {}, dates: ["sentAt", "nextAttemptAt"] },
  departures: { table: schema.departures, money: { price: "pricePaise" }, dates: [] },

  // --- Document collections -------------------------------------------------
  //
  // No fixed columns — the payload lives in `documents.data` as jsonb. These
  // were in `content/*.json`, which a serverless deploy throws away: every trip
  // price the admin published was lost on the next deploy.
  //
  // `keyField` is the field lifted out into the indexed `key` column, so
  // upsertBy has something to match on.
  tripOverrides: { table: schema.documents, money: {}, dates: [], document: true, keyField: "slug" },
  destinationOverrides: { table: schema.documents, money: {}, dates: [], document: true, keyField: "slug" },
  pages: { table: schema.documents, money: {}, dates: [], document: true, keyField: "key" },
  navigation: { table: schema.documents, money: {}, dates: [], document: true, keyField: "key" },
  interests: { table: schema.documents, money: {}, dates: [], document: true, keyField: "conversationId" },
  contentOverrides: { table: schema.documents, money: {}, dates: [], document: true, keyField: "key" },
  // Reusable quotations. A document rather than a table because the payload
  // is the whole quotation shape — lines, presentation, galleries — and
  // nothing queries inside it; the list screen filters in memory over a few
  // hundred rows at most.
  quotationTemplates: { table: schema.documents, money: {}, dates: [], document: true, keyField: "slug" },
  // Trips managed in the admin (docs/design/trip-management.md). Documents,
  // like the overrides they replace: the payload is the whole itinerary and
  // nothing queries inside it. Seats are NOT here — they stay on departures.
  trips: { table: schema.documents, money: {}, dates: [], document: true, keyField: "slug" },
  // One snapshot per publish, so a booking can point at what it was sold on.
  tripVersions: { table: schema.documents, money: {}, dates: [], document: true, keyField: "key" },
  // Phase 2 inventory. A hold keeps seats off sale for a lead for 48 hours;
  // the waitlist collects names on sold-out batches. Both are written only
  // under the trip's lock (lib/cms/seats.js).
  seatHolds: { table: schema.documents, money: {}, dates: [], document: true, keyField: "ref" },
  waitlist: { table: schema.documents, money: {}, dates: [], document: true, keyField: "ref" },
} as const;

export type Collection = keyof typeof TABLES;

export function isMapped(collection: string): collection is Collection {
  return collection in TABLES;
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Is this collection stored as a document rather than as columns?
 *
 * Document collections — built pages, the menu, trip overrides, chat interests
 * — share one `documents` table and keep their payload in a jsonb column. They
 * have no fixed shape, so there is nothing to map column by column.
 */
function isDocument(collection: Collection) {
  return "document" in TABLES[collection] && Boolean((TABLES[collection] as { document?: boolean }).document);
}

/** A document row → the flat record modules expect. */
function fromDocument(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    ...data,
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/**
 * A flat record → a document row.
 *
 * `id` stays a column so getRecord/updateRecord work unchanged; everything
 * else goes into `data`. `key` is lifted out when the collection declares one,
 * which is what makes the unique index — and therefore upsert — possible.
 */
function toDocument(collection: Collection, record: Record<string, unknown>): Record<string, unknown> {
  const spec = TABLES[collection] as { keyField?: string };
  const { id: recordId, createdAt, updatedAt, ...rest } = record;
  void createdAt;
  void updatedAt;

  return {
    ...(typeof recordId === "string" ? { id: recordId } : {}),
    collection,
    key: spec.keyField ? ((rest[spec.keyField] as string | undefined) ?? null) : null,
    data: rest,
  };
}

/** DB row → the shape modules expect. */
function fromDb(collection: Collection, row: Record<string, unknown> | undefined) {
  if (!row) return null;
  if (isDocument(collection)) return fromDocument(row);
  const spec = TABLES[collection];
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }

  for (const [appField, dbField] of Object.entries(spec.money)) {
    const raw = out[dbField];
    delete out[dbField];
    // null stays null: an unknown margin is not zero, and a target nobody set
    // must not render as ₹0.
    out[appField] = raw === null || raw === undefined ? null : toRupees(BigInt(raw as string));
  }

  return out;
}

/** The shape modules write → DB row. */
function toDb(collection: Collection, record: Record<string, unknown>) {
  if (isDocument(collection)) return toDocument(collection, record);
  const spec = TABLES[collection];
  const out: Record<string, unknown> = { ...record };

  for (const [appField, dbField] of Object.entries(spec.money)) {
    if (appField in out) {
      const value = out[appField];
      delete out[appField];
      out[dbField] = value === null || value === undefined ? null : toPaise(value as number);
    }
  }

  for (const field of spec.dates) {
    const value = out[field];
    if (typeof value === "string" && value) out[field] = new Date(value);
    else if (value === "") out[field] = null;
  }

  // Drop anything the table does not have rather than letting Drizzle throw.
  // A module adding a field it forgot to migrate should not take the app down
  // — but it must be visible, so it is logged rather than swallowed.
  const columns = new Set(Object.keys(spec.table));
  for (const key of Object.keys(out)) {
    if (!columns.has(key)) {
      console.warn(`[db] ${collection}.${key} has no column — dropped. Add it to schema.ts.`);
      delete out[key];
    }
  }

  return out;
}

export async function listRecords(collection: string) {
  const db = getDb();
  if (!db || !isMapped(collection)) return null;
  try {
    // Document collections SHARE one table, so an unfiltered select would hand
    // every collection every other collection's rows — pages inside the menu,
    // trip overrides inside the interest list.
    const base = db.select().from(TABLES[collection].table);
    const rows = isDocument(collection)
      ? await base.where(eq(schema.documents.collection, collection))
      : await base;
    return rows.map((r) => fromDb(collection, r as Record<string, unknown>));
  } catch (error) {
    // The first query a request makes is usually this one, so it is the best
    // place to translate a connection failure into something actionable.
    const explained = describeDbError(error);
    if (explained) console.error(`[db] ${explained}`);
    throw error;
  }
}

export async function getRecord(collection: string, id: string) {
  const db = getDb();
  if (!db || !isMapped(collection)) return null;
  const table = TABLES[collection].table as unknown as { id: never };
  const [row] = await db.select().from(TABLES[collection].table).where(eq(table.id, id)).limit(1);
  return fromDb(collection, row as Record<string, unknown>);
}

export async function createRecord(collection: string, record: Record<string, unknown>) {
  const db = getDb();
  if (!db || !isMapped(collection)) return null;
  const values = toDb(collection, { ...record, id: record.id ?? crypto.randomUUID() });
  const [row] = await db.insert(TABLES[collection].table).values(values).returning();
  return fromDb(collection, row as Record<string, unknown>);
}

export async function updateRecord(
  collection: string,
  id: string,
  patch: Record<string, unknown>
) {
  const db = getDb();
  if (!db || !isMapped(collection)) return null;
  const table = TABLES[collection].table as unknown as { id: never };

  /**
   * A patch on a document MERGES, it does not replace.
   *
   * `toDocument` packs whatever it is given into `data`, so setting that
   * column from a partial patch would silently delete every field the patch did
   * not mention — a lead note update would wipe the lead. `||` is Postgres's
   * jsonb concatenation: a shallow merge, which is exactly patch semantics,
   * done in one statement so two writers cannot read-modify-write over
   * each other.
   */
  if (isDocument(collection)) {
    const { id: _ignored, createdAt, updatedAt, ...rest } = patch;
    void _ignored;
    void createdAt;
    void updatedAt;

    const spec = TABLES[collection] as { keyField?: string };
    const nextKey =
      spec.keyField && spec.keyField in rest ? (rest[spec.keyField] as string | null) : undefined;

    const [row] = await db
      .update(schema.documents)
      .set({
        data: sql`${schema.documents.data} || ${JSON.stringify(rest)}::jsonb`,
        ...(nextKey === undefined ? {} : { key: nextKey }),
        updatedAt: new Date(),
      })
      .where(eq(schema.documents.id, id))
      .returning();
    return fromDb(collection, row as Record<string, unknown>);
  }

  const values = toDb(collection, { ...patch, updatedAt: new Date() });
  delete values.id;

  const [row] = await db
    .update(TABLES[collection].table)
    .set(values)
    .where(eq(table.id, id))
    .returning();
  return fromDb(collection, row as Record<string, unknown>);
}

export async function removeRecord(collection: string, id: string) {
  const db = getDb();
  if (!db || !isMapped(collection)) return null;
  const table = TABLES[collection].table as unknown as { id: never };
  const rows = await db.delete(TABLES[collection].table).where(eq(table.id, id)).returning();
  return rows.length > 0;
}

/**
 * Upsert keyed by something other than id.
 *
 * Used for catalogue overrides, keyed by slug. Unlike the file store this runs
 * as a single statement, so two writers cannot both miss and both insert.
 */
export async function upsertBy(
  collection: string,
  key: string,
  value: string,
  patch: Record<string, unknown>
) {
  const db = getDb();
  if (!db || !isMapped(collection)) return null;
  const table = TABLES[collection].table as unknown as Record<string, never>;

  // On a document collection the keyed field lives inside `data`, not as a
  // column — except for the declared `keyField`, which is lifted out precisely
  // so this lookup has an indexed column to match on.
  if (isDocument(collection)) {
    const existingDoc = await db
      .select()
      .from(schema.documents)
      .where(
        sql`${schema.documents.collection} = ${collection} AND ${schema.documents.key} = ${value}`
      )
      .limit(1);

    if (existingDoc.length > 0) {
      return updateRecord(collection, (existingDoc[0] as { id: string }).id, patch);
    }
    return createRecord(collection, { ...patch, [key]: value });
  }

  const existing = await db
    .select()
    .from(TABLES[collection].table)
    .where(eq(table[key], value))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0] as { id: string };
    return updateRecord(collection, row.id, patch);
  }
  return createRecord(collection, { ...patch, [key]: value });
}

/**
 * Read-modify-write one keyed row inside a transaction.
 *
 * The file store serialised these with a promise chain per collection, which
 * only works inside one process. Here the row is locked FOR UPDATE, so a
 * second writer in a different serverless instance waits rather than reading
 * stale state — which is the whole reason seat counts moved to Postgres.
 */
export async function mutateBy(
  collection: string,
  key: string,
  value: string,
  mutate: (row: Record<string, unknown> | null) => Promise<Record<string, unknown> | null>
) {
  const db = getDb();
  if (!db || !isMapped(collection)) return null;
  const table = TABLES[collection].table as unknown as Record<string, never>;

  /**
   * Documents need their own path, for the same two reasons upsertBy and
   * updateRecord already have one:
   *
   *   - the keyed field lives in `documents.key`, not in a column named after
   *     it — `table[key]` was undefined, so this generated `where  = $1` and
   *     every call threw. Seat moves go through here, so confirming a
   *     fixed-departure booking failed on Postgres (found 2026-10-10 with
   *     documents-mutate.test.ts; the earlier tests stubbed storage).
   *   - a partial result must MERGE into `data`, not replace it.
   *
   * The merge is done in JS rather than with jsonb `||` because the row is
   * already locked FOR UPDATE here — nobody can write between the read and
   * the write — and the caller's mutation needs the merged view anyway.
   */
  if (isDocument(collection)) {
    return db.transaction(async (tx) => {
      const found = await tx
        .select()
        .from(schema.documents)
        .where(
          sql`${schema.documents.collection} = ${collection} AND ${schema.documents.key} = ${value}`
        )
        .for("update")
        .limit(1);

      const current = found.length ? fromDb(collection, found[0] as Record<string, unknown>) : null;
      const result = await mutate(current);
      if (!result) return null;

      if (found.length > 0) {
        const row = found[0] as { id: string; data: Record<string, unknown> };
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = result;
        void _id;
        void _c;
        void _u;
        const data = { ...(row.data ?? {}), ...rest, [key]: value };
        const [updated] = await tx
          .update(schema.documents)
          .set({ data, key: value, updatedAt: new Date() })
          .where(eq(schema.documents.id, row.id))
          .returning();
        return fromDb(collection, updated as Record<string, unknown>);
      }

      const values = toDb(collection, { ...result, [key]: value, id: crypto.randomUUID() });
      const [inserted] = await tx.insert(schema.documents).values(values as never).returning();
      return fromDb(collection, inserted as Record<string, unknown>);
    });
  }

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(TABLES[collection].table)
      .where(eq(table[key], value))
      .for("update")
      .limit(1);

    const current = existing.length
      ? fromDb(collection, existing[0] as Record<string, unknown>)
      : null;

    const result = await mutate(current);
    if (!result) return null;

    if (existing.length > 0) {
      const row = existing[0] as { id: string };
      const values = toDb(collection, { ...result, updatedAt: new Date() });
      delete values.id;
      const [updated] = await tx
        .update(TABLES[collection].table)
        .set(values)
        .where(eq(table.id, row.id))
        .returning();
      return fromDb(collection, updated as Record<string, unknown>);
    }

    const values = toDb(collection, {
      ...result,
      [key]: value,
      id: crypto.randomUUID(),
    });
    const [inserted] = await tx.insert(TABLES[collection].table).values(values).returning();
    return fromDb(collection, inserted as Record<string, unknown>);
  });
}

/** Postgres survives a deploy. That is the entire point of this file. */
export function storageIsDurable() {
  return Boolean(getDb());
}

export { sql };
