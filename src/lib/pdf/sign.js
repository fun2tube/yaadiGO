import crypto from "node:crypto";

/**
 * Short-lived signatures for PDF render targets.
 *
 * `/pdf/quotation/[id]` shows a quotation — drafts included — to whoever
 * loads it, because the loader is our own headless browser with no session.
 * So the page demands a signature that only the server can mint, minted only
 * by an endpoint that has already checked who is asking (a staff session, or
 * the customer's token). It expires in five minutes: long enough for one
 * render, useless if it ever leaks into a log.
 *
 * Keyed on ADMIN_SESSION_SECRET with a purpose prefix, so a PDF signature can
 * never be replayed as a session cookie or the reverse.
 */

const TTL_SECONDS = 300;

function key() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET is not set; PDF links cannot be signed.");
  }
  return value;
}

function mac(kind, id, exp) {
  return crypto.createHmac("sha256", key()).update(`pdf:${kind}:${id}:${exp}`).digest("base64url");
}

/** `?exp=…&sig=…` for one render of one document. */
export function signedQuery(kind, id, now = Date.now()) {
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  return `exp=${exp}&sig=${mac(kind, id, exp)}`;
}

/** True only for an unexpired signature over exactly this kind and id. */
export function verifySignature(kind, id, exp, sig, now = Date.now()) {
  const expires = Number(exp);
  if (!Number.isInteger(expires) || typeof sig !== "string" || !sig) return false;
  if (expires < Math.floor(now / 1000)) return false;
  // Also refuse a far-future expiry — no legitimate signer produces one.
  if (expires > Math.floor(now / 1000) + TTL_SECONDS + 5) return false;

  let expected;
  try {
    expected = mac(kind, id, expires);
  } catch {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
