import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Where uploaded photographs live.
 *
 * SUPABASE STORAGE when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
 * — a public bucket (`SUPABASE_MEDIA_BUCKET`, default "media"), created on the
 * first upload. Talked to over its REST API, so there is no new dependency.
 *
 * Otherwise THE LOCAL DISK, under `uploads/` at the project root, served by
 * /api/media/file/…. That is fine on a long-lived server and in development,
 * and wrong on Vercel, where the filesystem is read-only and per-invocation —
 * so on a serverless host without Supabase an upload is refused with the
 * reason rather than "succeeding" into a file that vanishes.
 *
 * Paths are random (`2026/10/<uuid>.jpg`): nothing about the customer or the
 * hotel is in a URL, and URLs cannot be guessed.
 */

const EPHEMERAL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOCAL_DIR = path.join(process.cwd(), "uploads");

function supabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key, bucket: process.env.SUPABASE_MEDIA_BUCKET || "media" };
}

/** For the library screen's banner. */
export function describeMediaStorage() {
  if (supabase()) return { kind: "supabase", durable: true, label: "Supabase Storage" };
  if (EPHEMERAL) {
    return {
      kind: "none",
      durable: false,
      label: "No storage — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to upload on this host.",
    };
  }
  return {
    kind: "local",
    durable: false,
    label:
      "This server's disk. Fine for a long-lived server; on Vercel set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY instead.",
  };
}

export function uploadsAvailable() {
  return describeMediaStorage().kind !== "none";
}

function newPath(ext) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${ext}`;
}

async function supabaseFetch(cfg, pathname, init = {}) {
  return fetch(`${cfg.url}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30000),
  });
}

async function ensureBucket(cfg) {
  const response = await supabaseFetch(cfg, "/storage/v1/bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: cfg.bucket, name: cfg.bucket, public: true }),
  });
  // 409/400 "already exists" is success for our purposes.
  if (!response.ok && response.status !== 409 && response.status !== 400) {
    throw new Error(`Could not create the "${cfg.bucket}" bucket (${response.status}).`);
  }
}

/** Store the bytes. Returns { storagePath, url, backend }. */
export async function saveImage(bytes, { type, ext }) {
  const storagePath = newPath(ext);
  const cfg = supabase();

  if (cfg) {
    const put = () =>
      supabaseFetch(cfg, `/storage/v1/object/${cfg.bucket}/${storagePath}`, {
        method: "POST",
        headers: { "Content-Type": type, "x-upsert": "false", "Cache-Control": "31536000" },
        body: bytes,
      });
    let response = await put();
    if (response.status === 404 || response.status === 400) {
      // First upload ever: the bucket does not exist yet.
      await ensureBucket(cfg);
      response = await put();
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Supabase Storage refused the upload (${response.status}) ${detail.slice(0, 120)}`);
    }
    return {
      storagePath,
      backend: "supabase",
      url: `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${storagePath}`,
    };
  }

  if (EPHEMERAL) {
    throw new Error(
      "Uploads need Supabase Storage on this host: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const file = path.join(LOCAL_DIR, ...storagePath.split("/"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  return { storagePath, backend: "local", url: `/api/media/file/${storagePath}` };
}

/**
 * Read a locally stored file for /api/media/file. Refuses anything that is
 * not exactly one of our generated paths, so `..` and friends never reach
 * the filesystem.
 */
export async function readLocalImage(parts) {
  const joined = (parts ?? []).join("/");
  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(joined)) return null;
  const file = path.join(LOCAL_DIR, ...joined.split("/"));
  try {
    const bytes = await fs.readFile(file);
    const ext = joined.split(".").pop();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { bytes, type };
  } catch {
    return null;
  }
}
