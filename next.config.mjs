import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Pin the project root. Without this, Turbopack walks up looking for a
    // lockfile and can land on a stray package-lock.json in the home
    // directory, pulling everything above this folder into the build.
    root: __dirname,
  },
  // Prerendering reads the catalogue, navigation and overrides from Postgres.
  // With the database in ap-southeast-2 each query is 0.8–4 s from here, and
  // seven build workers × a pool of ten opened ~70 connections at once on the
  // Supabase pooler: pages queued past the 60 s limit and the build failed
  // (2026-10-11, review 2026-10-11-full-check). Fewer workers, more time.
  // Revisit once the database moves to Mumbai (backlog #35).
  staticPageGenerationTimeout: 180,
  // Next 16 only serves qualities listed here. Trip photos ask for 78
  // (components/img.js); without it every one logged a warning and was served
  // at 75 (review 2026-10-14-full-function-test, F20).
  images: {
    qualities: [75, 78],
  },
  experimental: {
    cpus: 2,
    staticGenerationMaxConcurrency: 2,
  },
  // The PDF endpoints launch Chromium from @sparticuz/chromium, which reads
  // its compressed binary from bin/ at runtime — a path the tracer cannot
  // see, so on Vercel the function would ship without a browser. Only these
  // three routes carry it (~70MB); nothing else pays for it.
  // See docs/design/pdf-downloads.md.
  outputFileTracingIncludes: {
    "/api/plan/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/q/*/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/admin/quotations/*/pdf": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
