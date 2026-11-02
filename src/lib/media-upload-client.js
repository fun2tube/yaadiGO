/**
 * Browser half of a photo upload: shrink, then send.
 *
 * A phone photo is 4–12 MB and 4000+ px wide. Nothing in a quotation is shown
 * wider than ~1000 px, and the host refuses bodies over 4.5 MB, so the photo
 * is redrawn at ≤ 2000 px on its long edge and re-encoded as JPEG before it
 * leaves the phone. That also strips EXIF — including the GPS position a
 * phone writes into every picture taken at a hotel.
 *
 * Browser-only (uses canvas). Imported by client components.
 */

import { MAX_EDGE_PX, looksLikeHeic, titleFromFileName } from "@/lib/media-rules";

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** → { blob, width, height } as JPEG, long edge ≤ MAX_EDGE_PX. */
export async function shrinkPhoto(file, { maxEdge = MAX_EDGE_PX, quality = 0.82 } = {}) {
  if (looksLikeHeic(file)) {
    throw new Error(
      "iPhone HEIC photos can't be read by the browser. Share it as JPEG (Settings → Camera → Formats → Most Compatible), or send it to yourself on WhatsApp and save that copy."
    );
  }
  const source = await decode(file).catch(() => {
    throw new Error("That file isn't a photo this browser can open.");
  });
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // JPEG has no transparency; a PNG logo on black looks broken.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  if (typeof source.close === "function") source.close();

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the photo."))), "image/jpeg", quality)
  );
  return { blob, width, height };
}

/**
 * Shrink and upload one file. Resolves to the library item.
 * @param {File} file
 * @param {{category?: string, tags?: string, destination?: string, title?: string}} meta
 */
export async function uploadPhoto(file, meta = {}) {
  const { blob, width, height } = await shrinkPhoto(file);
  const form = new FormData();
  form.set("file", blob, "photo.jpg");
  form.set("title", meta.title || titleFromFileName(file.name));
  form.set("category", meta.category || "other");
  if (meta.tags) form.set("tags", meta.tags);
  if (meta.destination) form.set("destination", meta.destination);
  form.set("width", String(width));
  form.set("height", String(height));

  const response = await fetch("/api/admin/media", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "The upload failed.");
  return data.item;
}
