import "server-only";

import { cache } from "react";

import { listRecords, upsertBy, storageIsDurable } from "@/lib/cms/records";


/**
 * The content store.
 *
 * Holds OVERRIDES, not content: a flat map of `field key -> new value` layered
 * over the code-defined defaults in src/lib/. That choice matters —
 *
 *   - the site still renders correctly with an empty store, so editing can
 *     never break a page into blankness;
 *   - a bad edit is reverted by deleting one key, not by restoring a backup;
 *   - the defaults stay reviewable in git.
 *
 * STORAGE IS AN ADAPTER. Today it is a JSON file, which works in local
 * development and on any long-lived Node host. It does NOT persist on
 * serverless platforms like Vercel, where the filesystem is read-only and
 * per-invocation — `describeStorage()` reports that, and the admin UI shows
 * it rather than silently losing an edit.
 *
 * To move to Postgres, replace readAll/writeAll with two queries. Nothing
 * else in the CMS knows where the data lives.
 */

// Serverless filesystems are ephemeral; anything writing there loses the edit
// on the next cold start. Detect the common platforms rather than guess.
const EPHEMERAL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const OVERRIDES = "contentOverrides";

const EMPTY = () => ({ text: {}, style: {}, image: {}, hidden: {}, updatedAt: null });

/**
 * Read the store fresh on every call. NOT cached in module scope, deliberately.
 *
 * `next start` runs several worker processes. A module-level cache is
 * per-process, so a write handled by worker A left workers B and C serving
 * the pre-edit content indefinitely — an edit that saved correctly and then
 * appeared to do nothing. Re-reading a small JSON file per render is cheap,
 * always correct, and behaves the same way the eventual database query will.
 */
async function readAll() {
  /**
   * Through the record layer, so Postgres holds this when it is configured.
   *
   * This used to call `fs.readFile`/`fs.writeFile` directly, bypassing the
   * record layer entirely — so every editable field on the site lived in
   * `content/overrides.json`, which a serverless deploy throws away. **Every
   * text edit an admin made would have been lost on the next deploy**: the
   * same data-loss class as the catalogue, on the feature the business asked
   * for most.
   */
  const rows = await listRecords(OVERRIDES);
  const row = rows?.find((r) => r.key === "main");
  if (!row) return EMPTY();

  return {
    // Tolerate a row written before a section existed.
    text: row.text ?? {},
    style: row.style ?? {},
    image: row.image ?? {},
    hidden: row.hidden ?? {},
    updatedAt: row.updatedAt ?? null,
  };
}

async function writeAll(next) {
  next.updatedAt = new Date().toISOString();
  await upsertBy(OVERRIDES, "key", "main", {
    key: "main",
    text: next.text,
    style: next.style,
    image: next.image,
    hidden: next.hidden,
  });
  return next;
}

/**
 * Everything, for rendering — ONCE per request.
 *
 * React.cache() dedupes by arguments for the lifetime of a single render, and
 * without it this was catastrophic: <Editable> awaits getOverrides() per
 * instance, the homepage renders 56 of them, and each one was its own database
 * round trip. Against a database 414ms away that is most of a ten-second page.
 *
 * Measured during the system audit: homepage 9.6s warm before, with the
 * queries dominating. It is not a micro-optimisation — it is the difference
 * between a usable site and an abandoned one on a phone.
 */
export const getOverrides = cache(async function getOverrides() {
  return readAll();
});

/** One field's current state, for the inspector and the agent. */
export async function getField(id) {
  const all = await readAll();
  return {
    id,
    text: all.text[id] ?? null,
    style: all.style[id] ?? null,
    image: all.image[id] ?? null,
    hidden: Boolean(all.hidden[id]),
  };
}

/**
 * Apply a patch. Passing null for a property clears it, which is how "reset
 * to the original" works — there is no separate delete path to get wrong.
 */
export async function patchField(id, patch) {
  const all = structuredClone(await readAll());

  for (const key of ["text", "style", "image"]) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === null || value === "" || (typeof value === "object" && value && Object.keys(value).length === 0)) {
      delete all[key][id];
    } else {
      all[key][id] = value;
    }
  }

  if ("hidden" in patch) {
    if (patch.hidden) all.hidden[id] = true;
    else delete all.hidden[id];
  }

  await writeAll(all);
  return getField(id);
}

/** Drop every override for a field — the "revert to original" button. */
export async function resetField(id) {
  const all = structuredClone(await readAll());
  delete all.text[id];
  delete all.style[id];
  delete all.image[id];
  delete all.hidden[id];
  await writeAll(all);
  return getField(id);
}

/** Everything that has been edited, for the admin dashboard. */
export async function listEdits() {
  const all = await readAll();
  const ids = new Set([
    ...Object.keys(all.text),
    ...Object.keys(all.style),
    ...Object.keys(all.image),
    ...Object.keys(all.hidden),
  ]);
  return {
    updatedAt: all.updatedAt,
    count: ids.size,
    items: [...ids].sort().map((id) => ({
      id,
      text: all.text[id] ?? null,
      style: all.style[id] ?? null,
      image: all.image[id] ?? null,
      hidden: Boolean(all.hidden[id]),
    })),
  };
}

/**
 * What the admin UI shows about where edits are going.
 *
 * It asks the record layer rather than assuming, because this store no longer
 * owns its own persistence — and a banner that says "your edits are safe"
 * while they are going to a file a deploy will delete is worse than no banner.
 */
export function describeStorage() {
  if (storageIsDurable()) {
    return {
      kind: "database",
      durable: true,
      message: "Edits are saved to the database and survive deploys.",
    };
  }

  if (EPHEMERAL) {
    return {
      kind: "ephemeral-file",
      durable: false,
      message:
        "No database is configured, so edits are written to the filesystem — which this host resets on every deploy and cold start. They will not survive. Set DATABASE_URL before editing in production.",
    };
  }

  return {
    kind: "file",
    durable: false,
    message:
      "No database is configured, so edits are saved to content/overrides.json on this machine only. Set DATABASE_URL to keep them.",
  };
}
