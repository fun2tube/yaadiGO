import "server-only";

import { createRecord, getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { media as BUILTIN } from "@/lib/media";
import { saveImage } from "@/lib/media-store";
import {
  MAX_UPLOAD_BYTES,
  MEDIA_CATEGORY_VALUES,
  categoryForTags,
  cleanTags,
  matchesQuery,
  sniffImage,
} from "@/lib/media-rules";

/**
 * The photo library: hotel rooms, destinations, activities, cars, maps.
 *
 * Before this a salesperson had to find a photo somewhere on the internet and
 * paste its link into the quotation — every time, for every hotel (reported
 * 2026-10-14). Now a photo is uploaded once and picked from here into any
 * quotation, and the 36 photographs the website already uses are offered
 * alongside as "Website photos" (read-only: they are licensed and credited).
 *
 * Archive, never delete: a quotation already with a customer may show the
 * photo, and its URL must keep working.
 */

export const MEDIA_LIBRARY = "mediaLibrary";

function builtinItems() {
  return BUILTIN.map((item) => ({
    id: item.id,
    builtin: true,
    url: item.src,
    width: item.width,
    height: item.height,
    title: item.title,
    alt: item.alt,
    description: item.description,
    tags: item.tags,
    category: categoryForTags(item.tags),
    destination: null,
    archived: false,
  }));
}

/**
 * Everything a picker can offer.
 *
 * @param {object} o
 * @param {string} [o.category]   one of MEDIA_CATEGORY_VALUES, or "all"
 * @param {string} [o.query]      free text
 * @param {boolean} [o.uploadsOnly]
 * @param {boolean} [o.includeArchived]
 */
export async function listMedia({ category = "all", query = "", uploadsOnly = false, includeArchived = false } = {}) {
  const uploads = ((await listRecords(MEDIA_LIBRARY)) ?? [])
    .filter((m) => includeArchived || !m.archived)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const all = uploadsOnly ? uploads : [...uploads, ...builtinItems()];
  return all.filter(
    (item) => (category === "all" || item.category === category) && matchesQuery(item, query)
  );
}

export async function getMedia(id) {
  return (await getRecord(MEDIA_LIBRARY, id)) ?? builtinItems().find((m) => m.id === id) ?? null;
}

/**
 * Store an upload and catalogue it.
 *
 * `bytes` is what the browser sent after downscaling. Its type is read from
 * its first bytes; the name and the browser's claim are ignored.
 */
export async function uploadMedia({ bytes, title, alt, category, tags, destination, width, height, actor }) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (buffer.byteLength === 0) return { error: "That file is empty." };
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { error: "That photo is still over 4 MB after shrinking. Try a smaller one." };
  }
  const kind = sniffImage(buffer);
  if (!kind) return { error: "Only JPEG, PNG or WebP photos can be uploaded." };

  const cat = MEDIA_CATEGORY_VALUES.includes(category) ? category : "other";
  const cleanTitle = String(title ?? "").trim().slice(0, 120) || "Untitled photo";

  const stored = await saveImage(buffer, kind);

  const item = await createRecord(MEDIA_LIBRARY, {
    storagePath: stored.storagePath,
    backend: stored.backend,
    url: stored.url,
    type: kind.type,
    bytes: buffer.byteLength,
    width: Number(width) || null,
    height: Number(height) || null,
    title: cleanTitle,
    alt: String(alt ?? "").trim().slice(0, 200) || cleanTitle,
    category: cat,
    tags: cleanTags(tags),
    destination: String(destination ?? "").trim().slice(0, 80) || null,
    archived: false,
    uploadedById: actor?.id ?? null,
    uploadedByName: actor?.name ?? null,
  });
  return { item };
}

/** Edit the catalogue entry — never the bytes. */
export async function updateMedia(id, patch) {
  const item = await getRecord(MEDIA_LIBRARY, id);
  if (!item) return { error: "No such photo — website photos cannot be edited here." };

  const next = {};
  if ("title" in patch) next.title = String(patch.title ?? "").trim().slice(0, 120) || item.title;
  if ("alt" in patch) next.alt = String(patch.alt ?? "").trim().slice(0, 200) || next.title || item.title;
  if ("category" in patch && MEDIA_CATEGORY_VALUES.includes(patch.category)) next.category = patch.category;
  if ("tags" in patch) next.tags = cleanTags(patch.tags);
  if ("destination" in patch) next.destination = String(patch.destination ?? "").trim().slice(0, 80) || null;
  if ("archived" in patch) next.archived = Boolean(patch.archived);
  if (Object.keys(next).length === 0) return { error: "Nothing to change." };

  return { item: await updateRecord(MEDIA_LIBRARY, id, next) };
}
