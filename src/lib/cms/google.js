import "server-only";

import crypto from "node:crypto";

/**
 * Google sign-in, written against the documented OAuth endpoints.
 *
 * No auth library: this is one redirect and one token exchange, and a library
 * here would bring a framework's worth of opinions for those two calls.
 *
 * Two things carry the security of this flow, and both are easy to leave out:
 *
 *   STATE — a signed, expiring value round-tripped through Google. Without it
 *   an attacker can feed a victim's browser their own authorisation code and
 *   log the victim into the attacker's account (CSRF on login). It is signed
 *   rather than stored so it works on a serverless host with no session.
 *
 *   EMAIL VERIFICATION — Google's `email_verified` claim is checked before the
 *   email is trusted to identify anyone. An unverified Google account can
 *   claim any address, which would otherwise be a free pass into a colleague's
 *   account.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_TTL_MS = 10 * 60 * 1000;

function secret() {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && secret());
}

/**
 * The redirect URI must match what is registered in the Google Cloud console
 * EXACTLY, including scheme, host, port and path. Derived from the incoming
 * request so localhost and production both work without a second variable,
 * unless GOOGLE_REDIRECT_URI pins it (needed behind a proxy that rewrites the
 * host).
 */
export function redirectUri(request) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const url = new URL(request.url);
  return `${url.origin}/api/admin/auth/google/callback`;
}

function signState(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createState(next = "/admin") {
  const expires = Date.now() + STATE_TTL_MS;
  const nonce = crypto.randomBytes(12).toString("base64url");
  // `next` is encoded so a redirect target cannot smuggle a separator through.
  const payload = `${nonce}.${expires}.${Buffer.from(next).toString("base64url")}`;
  return `${payload}.${signState(payload)}`;
}

export function readState(value) {
  const parts = String(value ?? "").split(".");
  if (parts.length !== 4) return null;

  const [nonce, expires, next, signature] = parts;
  const expected = signState(`${nonce}.${expires}.${next}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expires) < Date.now()) return null;

  let target = "/admin";
  try {
    target = Buffer.from(next, "base64url").toString();
  } catch {
    // Fall through to the default.
  }
  // Only ever redirect inside this site. "//evil.com" is a protocol-relative
  // URL that browsers treat as external, so a leading-slash check alone is
  // not enough.
  if (!target.startsWith("/") || target.startsWith("//")) target = "/admin";
  return { next: target };
}

export function authorizeUrl(request, next) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", createState(next));
  // Staff sign-in: always let them pick which account, rather than silently
  // reusing whichever Google session the browser happens to have.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Exchange the code and return the verified identity, or throw. */
export async function exchange(request, code) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google token exchange failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const { access_token: accessToken } = await response.json();

  const profile = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!profile.ok) throw new Error(`Google userinfo failed (${profile.status})`);

  const info = await profile.json();

  // An unverified address proves nothing about who owns it.
  if (!info.email || info.email_verified === false) {
    throw new Error("That Google account has no verified email address.");
  }

  return {
    googleId: info.sub,
    email: String(info.email).toLowerCase(),
    name: info.name ?? null,
    picture: info.picture ?? null,
  };
}
