import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";

import { userCan } from "@/lib/crm/schema";
import { findForSignIn, getUser, recordSignIn, verifyPassword } from "@/lib/cms/users";

/**
 * Staff authentication.
 *
 * Previously a single shared password. That was the right size for a content
 * editor and the wrong size for a CRM: every figure on the reports screen
 * answers "which salesperson", and one shared login makes that unanswerable.
 *
 * The session is a signed cookie carrying the user id — no server-side session
 * store, which keeps it working on a serverless host. What it gets right,
 * because these are the parts people skip:
 *   - passwords are scrypt-hashed per user, never stored or echoed;
 *   - comparison is timing-safe, and a missing account costs the same time as
 *     a wrong password;
 *   - the cookie is HMAC-signed, so its contents cannot be edited;
 *   - permissions are re-read from the record on every request, so suspending
 *     someone bites immediately rather than when their cookie expires.
 */

export const SESSION_COOKIE = "yaadigo_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 16) return null;
  return value;
}

export function adminConfigured() {
  return Boolean(secret());
}

/** Why sign-in cannot be used, in words a developer can act on. */
export function adminConfigError() {
  if (!secret()) {
    return "ADMIN_SESSION_SECRET is not set, or is shorter than 16 characters. Add a long random string to .env.local.";
  }
  if (!process.env.ADMIN_PASSWORD) {
    return "ADMIN_PASSWORD is not set. It seeds the first admin account on an empty install.";
  }
  return null;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createSessionValue(userId) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function readSessionValue(value) {
  if (!value || !secret()) return null;
  const parts = String(value).split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  if (!safeEqual(signature, sign(`${userId}.${expires}`))) return null;
  if (Number(expires) < Date.now()) return null;
  return { userId };
}

export const SESSION_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Who is making this request, or null.
 *
 * Permissions come from the stored record, never the cookie. A cookie lasts
 * twelve hours; if someone is suspended or loses a module in that window the
 * change has to bite now.
 */
export async function currentUser() {
  const jar = await cookies();
  const session = readSessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await getUser(session.userId);
  if (!user || user.status !== "active") return null;
  return user;
}

/**
 * Sign in with a password.
 *
 * Returns { user } or { error } where error is a stable code — the ROUTE
 * decides what to reveal. "Awaiting approval" is worth telling someone;
 * "no such account" is not, because it turns the form into an email prober.
 */
export async function signIn(email, password) {
  const record = await findForSignIn(email);

  // Hash a throwaway value when there is no account, so a missing email and a
  // wrong password take the same time to answer. Otherwise the response time
  // alone tells an attacker which emails are real.
  if (!record || !record.passwordHash) {
    await verifyPassword(password ?? "", "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    return { error: "credentials" };
  }

  if (!(await verifyPassword(password, record.passwordHash))) return { error: "credentials" };

  if (record.status === "invited") return { error: "not-set-up" };
  if (record.status === "pending") return { error: "pending" };
  if (record.status === "suspended") return { error: "suspended" };

  await recordSignIn(record.id);
  const { passwordHash, inviteTokenHash, resetTokenHash, ...user } = record;
  return { user };
}

export async function startSession(userId) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(userId), SESSION_OPTIONS);
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Signed in at all? */
export async function isAdmin() {
  return Boolean(await currentUser());
}

/**
 * For route handlers. Returns a Response when the request should be refused,
 * otherwise null — so a route reads:
 *
 *   const denied = await requireAuth("leads.write");
 *   if (denied) return denied;
 */
export async function requireAuth(permission) {
  const { denied } = await authorise(permission);
  return denied ?? null;
}

/**
 * The same check, but hands back the user so the route can attribute the
 * change. Returns { user } or { denied }.
 */
export async function authorise(permission) {
  const user = await currentUser();
  if (!user) {
    return { denied: Response.json({ message: "Not signed in." }, { status: 401 }) };
  }
  if (permission && !userCan(user, permission)) {
    return {
      denied: Response.json(
        { message: "Your account does not have access to that." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

/** Kept so the existing content-editor routes keep working unchanged. */
export async function requireAdmin() {
  return requireAuth();
}
