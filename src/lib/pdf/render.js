import "server-only";
import { existsSync } from "node:fs";
import { SITE_URL } from "@/lib/site";
import { enforceRateLimit, RateLimitedError } from "@/lib/ai";

/**
 * Turns one of our own pages into a PDF, server-side, with headless Chromium.
 *
 * Why a browser and not a PDF library: the quotation templates and the
 * planner's day cards already exist as HTML designed for print. Rendering
 * THAT page means the PDF is the document the customer sees on screen — a
 * template change can never leave the PDF saying something the page does not.
 * See docs/design/pdf-downloads.md §1.
 *
 * Where the browser comes from:
 *   - on Vercel / Lambda: `@sparticuz/chromium`, a Chromium built for that
 *     runtime (pinned to 153, the version puppeteer-core 25.11 speaks);
 *   - anywhere else: `CHROME_PATH`, or the first Chrome / Edge / Chromium
 *     found in the usual places. Development needs no extra download.
 */

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const LOCAL_BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

/** Thrown when there is no browser to render with. The message is for staff. */
export class PdfUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "PdfUnavailableError";
  }
}

async function launch() {
  const { default: puppeteer } = await import("puppeteer-core");

  if (IS_SERVERLESS) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });
  }

  const executablePath = LOCAL_BROWSERS.find((path) => existsSync(path));
  if (!executablePath) {
    throw new PdfUnavailableError(
      "No Chrome, Edge or Chromium found to render PDFs. Install one, or set CHROME_PATH."
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      // Docker's default seccomp profile leaves Chromium no usable sandbox.
      // Set by the Dockerfile; renderPdf only ever loads our own origin.
      ...(process.env.CHROME_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
    ],
  });
}

// One browser per warm server instance. Launching costs 1–3 s; a page costs
// tens of milliseconds. Reset on disconnect so a crashed browser is replaced
// rather than handing every later request a dead handle.
let browserPromise = null;

async function browser() {
  if (!browserPromise) {
    browserPromise = launch().then((instance) => {
      instance.on("disconnected", () => {
        browserPromise = null;
      });
      return instance;
    });
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/**
 * The origin the headless browser is allowed to load.
 *
 * Never taken blindly from the request's Host header: a forged Host would
 * otherwise send our server's browser to an attacker's page (SSRF). Local
 * hosts in development; in production only the site itself or this
 * deployment's own Vercel hostnames; anything else falls back to SITE_URL.
 */
export function renderOrigin(request) {
  const requested = new URL(request.url);
  const host = requested.hostname;
  const allowed = new Set(
    [
      new URL(SITE_URL).hostname,
      new URL(SITE_URL).hostname.replace(/^www\./, ""),
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ]
      .filter(Boolean)
      .map((h) => h.replace(/^https?:\/\//, "").split("/")[0])
  );
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";

  // `next dev`, or `next start` on a machine. Never on Vercel, where a
  // "localhost" Host header can only be forged.
  if (local && !IS_SERVERLESS) return requested.origin;
  if (allowed.has(host)) return `https://${host}`;
  return SITE_URL;
}

/**
 * Render `path` on `origin` to an A4 PDF.
 *
 * `inject` is placed on `window.__YAADIGO_PDF__` before any of the page's own
 * scripts run — how the itinerary reaches the page without being stored or
 * put in a URL.
 */
export async function renderPdf({ origin, path, inject = null, title = "YaadiGo" }) {
  const instance = await browser();
  const page = await instance.newPage();
  const allowedOrigin = new URL(origin).origin;

  try {
    // A4 at 96dpi, so responsive layouts pick their print-width variant.
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.emulateMediaType("print");

    // Only our own pages may be navigated to. Third-party images, fonts and
    // stylesheets may load (Google Fonts, hotel photos by URL); third-party
    // documents and scripts may not.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return req.continue();
      let sameOrigin = false;
      try {
        sameOrigin = new URL(url).origin === allowedOrigin;
      } catch {
        return req.abort();
      }
      if (sameOrigin) return req.continue();
      const type = req.resourceType();
      if (type === "image" || type === "font" || type === "stylesheet") return req.continue();
      return req.abort();
    });

    if (inject) {
      await page.evaluateOnNewDocument((data) => {
        window.__YAADIGO_PDF__ = data;
      }, inject);
    }

    const response = await page.goto(`${allowedOrigin}${path}`, {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });
    if (!response || !response.ok()) {
      throw new Error(`The document page answered ${response?.status() ?? "nothing"}.`);
    }

    // The render target sets this once its content is in the DOM — the
    // itinerary page renders on the client, so "network idle" alone is not
    // proof that the days are there.
    await page.waitForSelector("[data-pdf-ready]", { timeout: 20_000 });

    // Lazy images below the fold never load in a page nobody scrolls, and
    // print does not wait for them. Make every image eager and wait for it.
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      images.forEach((img) => {
        img.loading = "eager";
        img.decoding = "sync";
      });
      await Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
                setTimeout(resolve, 8000);
              })
        )
      );
      await document.fonts.ready;
    });

    const footer = `
      <div style="width:100%;padding:0 14mm;font-family:Arial,sans-serif;font-size:7.5px;color:#8b857b;display:flex;justify-content:space-between;">
        <span>${escapeHtml(title)}</span>
        <span>yaadigo.com · Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`;

    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
    });
  } finally {
    await page.close().catch(() => {});
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A filename that survives every OS and mail client. */
export function pdfFilename(...parts) {
  const slug = parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${slug || "YaadiGo"}.pdf`;
}

/** The download response. `no-store`: these are one person's prices. */
export function pdfResponse(buffer, filename) {
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Public PDF endpoints start a browser render per request, so they are
 * limited per IP. Returns a 429 Response to send, or null to carry on.
 */
export function limitDownloads(request, bucket, perHour = 20) {
  try {
    enforceRateLimit(request, bucket, perHour);
    return null;
  } catch (error) {
    if (!(error instanceof RateLimitedError)) throw error;
    const minutes = Math.ceil(error.retryAfterSeconds / 60);
    return Response.json(
      { message: `That's a lot of downloads in an hour. Try again in ${minutes} minutes.` },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
    );
  }
}
