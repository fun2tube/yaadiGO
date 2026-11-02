/**
 * The rules for uploaded photographs — browser-safe and pure, so the upload
 * screen and the server agree, and both are tested (media-rules.test.js).
 *
 * See docs/design/2026-10-14-media-quotes-reports.md.
 */

export const MEDIA_CATEGORIES = [
  { value: "hotel", label: "Hotels & stays" },
  { value: "destination", label: "Destinations & trips" },
  { value: "activity", label: "Activities & sightseeing" },
  { value: "transport", label: "Cars & transport" },
  { value: "flight", label: "Flights" },
  { value: "map", label: "Route maps" },
  { value: "other", label: "Other" },
];

export const MEDIA_CATEGORY_VALUES = MEDIA_CATEGORIES.map((c) => c.value);

/** After the browser has downscaled it. Vercel refuses request bodies over 4.5 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** The long edge the browser scales a photo down to before sending it. */
export const MAX_EDGE_PX = 2000;

/**
 * What the bytes actually are — never the file name or the browser's claim.
 * Returns { type, ext } or null.
 */
export function sniffImage(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { type: "image/png", ext: "png" };
  }
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

/** HEIC/HEIF — what iPhones save. Browsers cannot draw them, so they cannot be downscaled. */
export function looksLikeHeic(file) {
  const name = String(file?.name ?? "").toLowerCase();
  const type = String(file?.type ?? "").toLowerCase();
  return /\.(heic|heif)$/.test(name) || type.includes("heic") || type.includes("heif");
}

/** A title from a file name: "IMG_2041 taj-malabar_pool.jpg" → "Taj malabar pool". */
export function titleFromFileName(name) {
  const base = String(name ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\b(img|dsc|pxl|photo|image)[-_ ]?\d+\b/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!base) return "Untitled photo";
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

/** Tags as typed: "Kerala, houseboat ,  Alleppey" → ["kerala","houseboat","alleppey"]. */
export function cleanTags(input) {
  const list = Array.isArray(input) ? input : String(input ?? "").split(",");
  return [
    ...new Set(
      list
        .map((t) => String(t).trim().toLowerCase().replace(/\s+/g, "-"))
        .filter((t) => t.length > 0 && t.length <= 40)
    ),
  ].slice(0, 20);
}

/** Free-text search over a library item — title, alt, tags, destination, category. */
export function matchesQuery(item, query) {
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return true;
  const hay = [item.title, item.alt, item.description, item.destination, item.category, ...(item.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((word) => hay.includes(word));
}

/**
 * The category of a built-in site photo, from its tags. Those photos predate
 * categories; most are destination shots.
 */
export function categoryForTags(tags = []) {
  const t = new Set(tags);
  if (t.has("hotel") || t.has("stay") || t.has("houseboat") || t.has("resort")) return "hotel";
  if (t.has("map")) return "map";
  if (t.has("flight") || t.has("airport")) return "flight";
  if (t.has("car") || t.has("transport") || t.has("road-trip")) return "transport";
  if (t.has("activity") || t.has("trek") || t.has("safari") || t.has("adventure")) return "activity";
  return "destination";
}

/**
 * What a quotation stores for a picked image. A built-in photo by id (the
 * renderer resolves it through next/image); an upload by URL, with its library
 * id kept for reference. The renderer needs no lookup either way, so a
 * quotation keeps its pictures even if the photo is later archived.
 */
export function pickValue(item) {
  if (!item) return null;
  if (item.builtin) return { id: item.id, url: null, alt: item.alt ?? item.title ?? "" };
  return { id: null, url: item.url, mediaId: item.id, alt: item.alt ?? item.title ?? "" };
}
