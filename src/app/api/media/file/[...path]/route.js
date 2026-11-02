import { readLocalImage } from "@/lib/media-store";

export const dynamic = "force-dynamic";

/**
 * Serves photos uploaded to the local disk (lib/media-store.js). Public on
 * purpose: the customer's quotation page and its PDF show these images to
 * people with no session. Paths are random UUIDs, so nothing is listable or
 * guessable, and only our own path shape is ever read.
 */
export async function GET(_request, { params }) {
  const { path } = await params;
  const file = await readLocalImage(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.bytes, {
    headers: {
      "Content-Type": file.type,
      // The path is content-addressed by a fresh UUID; it never changes.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
