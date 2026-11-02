import "server-only";

import { listRecords, upsertBy } from "@/lib/cms/records";

/**
 * Builder-made pages.
 *
 * The same rule the override store follows, for the same reason: **an empty
 * store renders exactly the site that is in git.** A page only stops being the
 * coded one once somebody has published a layout for it, and deleting that
 * record puts the coded page back. There is no migration, no "export your
 * site", and no way for a bad edit to lose the original.
 *
 * `draft` and `published` are separate documents on the same record. The
 * builder saves to `draft` continuously; `published` is what visitors get. A
 * half-finished page sitting in an open tab is not a reason for the public site
 * to change.
 */

export const PAGES = "pages";

/** Slug for the route. "/" is stored as "home" — an empty key is a bug magnet. */
export function pageKey(path) {
  const trimmed = String(path ?? "/").replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "home" : trimmed;
}

export async function getPage(path) {
  const key = pageKey(path);
  const rows = await listRecords(PAGES);
  return rows.find((row) => row.key === key) ?? null;
}

/**
 * The layout a VISITOR should see, or null to fall through to the coded page.
 *
 * Returns null for an unpublished page and for a published-but-empty one. An
 * empty block list is almost always an accident — somebody cleared the canvas
 * and published — and rendering a blank page over a working one is the worst
 * possible interpretation of it.
 */
export async function getPublishedLayout(path) {
  const page = await getPage(path);
  if (!page?.published) return null;
  if (!Array.isArray(page.published.content) || page.published.content.length === 0) return null;
  return page.published;
}

/** What the builder opens: the draft if there is one, else the published copy. */
export async function getEditableLayout(path) {
  const page = await getPage(path);
  return page?.draft ?? page?.published ?? null;
}

export async function saveDraft(path, data, { actor } = {}) {
  return upsertBy(PAGES, "key", pageKey(path), {
    key: pageKey(path),
    draft: data,
    draftAt: new Date().toISOString(),
    draftBy: actor?.name ?? null,
  });
}

export async function publishPage(path, data, { actor } = {}) {
  return upsertBy(PAGES, "key", pageKey(path), {
    key: pageKey(path),
    published: data,
    // The draft is kept, not cleared: publishing is not the end of editing, and
    // the next session should open where the last one left off.
    draft: data,
    publishedAt: new Date().toISOString(),
    publishedBy: actor?.name ?? null,
  });
}

/** Revert to the coded page by dropping the published layout. */
export async function unpublishPage(path, { actor } = {}) {
  return upsertBy(PAGES, "key", pageKey(path), {
    key: pageKey(path),
    published: null,
    unpublishedAt: new Date().toISOString(),
    unpublishedBy: actor?.name ?? null,
  });
}

export async function listPages() {
  return listRecords(PAGES);
}
