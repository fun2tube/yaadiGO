import "server-only";

import crypto from "node:crypto";
import { createRecord, listRecords, getRecord, updateRecord } from "@/lib/cms/records";
import { ROLE_VALUES, permissionsForRole, ALL_PERMISSIONS } from "@/lib/crm/schema";

/**
 * Staff accounts.
 *
 * The shared password this replaced was fine for a content editor. It is not
 * fine for a CRM: "which salesperson closed this" has no answer when everyone
 * signs in as the same person, and every KPI in the system depends on that
 * answer.
 *
 * The lifecycle is invite → set a password → an admin approves → active. The
 * approval step is the one that matters: an invite link can be forwarded, and
 * without a human gate anyone who receives it walks straight into the customer
 * database.
 *
 * Passwords are scrypt-hashed with a per-user salt. scrypt is in node's crypto
 * module, so this needs no dependency, and it is deliberately slow — the point
 * of a password hash is that guessing is expensive.
 */

export const USERS = "users";

const KEYLEN = 64;
// Defaults are node's; named so the cost is visible and tunable.
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const INVITE_HOURS = 72;
const RESET_HOURS = 2;

function hash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, SCRYPT, (error, derived) =>
      error ? reject(error) : resolve(derived.toString("base64"))
    );
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  return `scrypt$${salt}$${await hash(password, salt)}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;

  const actual = await hash(password ?? "", salt);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Tokens are stored HASHED.
 *
 * An invite or reset token is a bearer credential: whoever holds it can take
 * over an account. Storing the raw value means a leaked backup or a careless
 * console.log of a user record hands those out. Only the recipient ever sees
 * the plaintext.
 */
function tokenPair() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, digest: crypto.createHash("sha256").update(raw).digest("hex") };
}

function digestOf(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

function normaliseEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function passwordProblem(password) {
  if (!password || password.length < 10) return "Use a password of at least 10 characters.";
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
}

/** Never let a hash or a token digest leave this module. */
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, inviteTokenHash, resetTokenHash, ...rest } = user;
  return rest;
}

export async function listUsers({ includeInactive = false } = {}) {
  const rows = await listRecords(USERS);
  const visible = includeInactive ? rows : rows.filter((u) => u.status === "active");
  return visible
    .map(publicUser)
    .sort((a, b) => String(a.name ?? a.email).localeCompare(String(b.name ?? b.email)));
}

export async function getUser(id) {
  return publicUser(await getRecord(USERS, id));
}

/** By email, WITH secrets — only for sign-in and token flows. */
async function findRaw(email) {
  const rows = await listRecords(USERS);
  return rows.find((u) => normaliseEmail(u.email) === normaliseEmail(email)) ?? null;
}

export { findRaw as findForSignIn };

function sanitisePermissions(list, role) {
  if (role === "admin") return ["*"];
  const allowed = new Set(ALL_PERMISSIONS);
  return [...new Set((list ?? []).filter((p) => allowed.has(p)))];
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/**
 * Invite someone. Returns the raw token so the caller can build the link —
 * this is the only moment it exists in plaintext.
 */
export async function inviteUser({ email, name, role, permissions, invitedBy }) {
  if (!ROLE_VALUES.includes(role)) return { error: "Unknown role." };

  const clean = normaliseEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return { error: "That email doesn't look right." };

  const existing = await findRaw(clean);
  if (existing && existing.status !== "invited") {
    return { error: "That email already has an account." };
  }

  const { raw, digest } = tokenPair();
  const expires = new Date(Date.now() + INVITE_HOURS * 3600 * 1000).toISOString();
  const seeded = sanitisePermissions(permissions ?? permissionsForRole(role), role);

  const payload = {
    email: clean,
    name: name?.trim() || null,
    role,
    permissions: seeded,
    status: "invited",
    inviteTokenHash: digest,
    inviteExpiresAt: expires,
    invitedById: invitedBy?.id ?? null,
    invitedByName: invitedBy?.name ?? null,
    passwordHash: null,
    googleId: null,
    monthlyTarget: null,
    lastSignInAt: null,
  };

  // Re-inviting replaces the old token rather than stacking accounts.
  const user = existing
    ? await updateRecord(USERS, existing.id, payload)
    : await createRecord(USERS, payload);

  return { user: publicUser(user), token: raw, expiresAt: expires };
}

export async function findByInviteToken(raw) {
  const rows = await listRecords(USERS);
  const user = rows.find((u) => u.inviteTokenHash && u.inviteTokenHash === digestOf(raw));
  if (!user) return null;
  if (new Date(user.inviteExpiresAt ?? 0).getTime() < Date.now()) return { expired: true, user: publicUser(user) };
  return { user };
}

/**
 * The invitee sets their own name and password.
 *
 * Lands them in `pending`, not `active` — an invite link can be forwarded, so
 * a human still has to confirm this is the person they meant.
 */
export async function acceptInvite(raw, { name, password }) {
  const found = await findByInviteToken(raw);
  if (!found) return { error: "That invitation link is not valid." };
  if (found.expired) return { error: "That invitation has expired. Ask for a new one." };

  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const user = await updateRecord(USERS, found.user.id, {
    name: name?.trim() || found.user.name || found.user.email,
    passwordHash: await hashPassword(password),
    status: "pending",
    // Single use.
    inviteTokenHash: null,
    inviteExpiresAt: null,
    acceptedAt: new Date().toISOString(),
  });

  return { user: publicUser(user) };
}

export async function approveUser(id, { approvedBy } = {}) {
  const user = await getRecord(USERS, id);
  if (!user) return { error: "No such account." };
  if (user.status === "active") return { user: publicUser(user) };
  if (!user.passwordHash && !user.googleId) {
    return { error: "They haven't set up their account yet." };
  }

  const updated = await updateRecord(USERS, id, {
    status: "active",
    approvedAt: new Date().toISOString(),
    approvedById: approvedBy?.id ?? null,
    approvedByName: approvedBy?.name ?? null,
  });
  return { user: publicUser(updated) };
}

export async function setStatus(id, status) {
  if (!["pending", "active", "suspended"].includes(status)) return { error: "Unknown status." };
  const updated = await updateRecord(USERS, id, { status });
  if (!updated) return { error: "No such account." };
  return { user: publicUser(updated) };
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export async function beginPasswordReset(email) {
  const user = await findRaw(email);
  // Deliberately returns a token only when the account can actually use it,
  // but the CALLER must respond identically either way — see the route.
  if (!user || user.status === "suspended") return null;

  const { raw, digest } = tokenPair();
  await updateRecord(USERS, user.id, {
    resetTokenHash: digest,
    resetExpiresAt: new Date(Date.now() + RESET_HOURS * 3600 * 1000).toISOString(),
  });
  return { user: publicUser(user), token: raw };
}

export async function completePasswordReset(raw, password) {
  const rows = await listRecords(USERS);
  const user = rows.find((u) => u.resetTokenHash && u.resetTokenHash === digestOf(raw));
  if (!user) return { error: "That reset link is not valid." };
  if (new Date(user.resetExpiresAt ?? 0).getTime() < Date.now()) {
    return { error: "That reset link has expired. Ask for a new one." };
  }

  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const updated = await updateRecord(USERS, user.id, {
    passwordHash: await hashPassword(password),
    resetTokenHash: null,
    resetExpiresAt: null,
  });
  return { user: publicUser(updated) };
}

export async function changePassword(id, { current, next }) {
  const user = await getRecord(USERS, id);
  if (!user) return { error: "No such account." };

  // Someone who only ever signed in with Google has no password to confirm.
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) {
    return { error: "That current password is not right." };
  }

  const problem = passwordProblem(next);
  if (problem) return { error: problem };

  await updateRecord(USERS, id, { passwordHash: await hashPassword(next) });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

/**
 * Link or find an account by verified Google identity.
 *
 * IMPORTANT: this never creates an account. Google sign-in proves who someone
 * is, not that they should be let in — without an existing invitation, anyone
 * with a Google account could sign into the customer database. An unknown
 * email is refused here, not quietly registered.
 */
export async function findForGoogle({ email, googleId, name }) {
  const user = await findRaw(email);
  if (!user) return { error: "unknown" };
  if (user.status === "suspended") return { error: "suspended" };

  const patch = {};
  if (!user.googleId) patch.googleId = googleId;
  if (!user.name && name) patch.name = name;
  // Someone invited who signs in with Google never needs to set a password.
  if (user.status === "invited") {
    patch.status = "pending";
    patch.inviteTokenHash = null;
    patch.inviteExpiresAt = null;
    patch.acceptedAt = new Date().toISOString();
  }

  const updated = Object.keys(patch).length ? await updateRecord(USERS, user.id, patch) : user;
  return { user: publicUser(updated) };
}

// ---------------------------------------------------------------------------
// Admin edits
// ---------------------------------------------------------------------------

export async function updateUser(id, patch) {
  const user = await getRecord(USERS, id);
  if (!user) return { error: "No such account." };

  const allowed = {};
  if (patch.name !== undefined) allowed.name = String(patch.name).trim();
  if (patch.role !== undefined) {
    if (!ROLE_VALUES.includes(patch.role)) return { error: "Unknown role." };
    allowed.role = patch.role;
    // Changing role reseeds permissions unless the caller sent their own.
    if (patch.permissions === undefined) {
      allowed.permissions = sanitisePermissions(permissionsForRole(patch.role), patch.role);
    }
  }
  if (patch.permissions !== undefined) {
    allowed.permissions = sanitisePermissions(patch.permissions, patch.role ?? user.role);
  }
  if (patch.monthlyTarget !== undefined) {
    allowed.monthlyTarget =
      patch.monthlyTarget === null ? null : Math.max(0, Number(patch.monthlyTarget) || 0);
  }

  const updated = await updateRecord(USERS, id, allowed);
  return { user: publicUser(updated) };
}

export async function recordSignIn(id) {
  await updateRecord(USERS, id, { lastSignInAt: new Date().toISOString() });
}

export async function countAdmins() {
  const rows = await listRecords(USERS);
  return rows.filter((u) => u.role === "admin" && u.status === "active").length;
}

/**
 * Make sure somebody can always get in.
 *
 * On an empty install the ADMIN_PASSWORD that used to be the whole auth system
 * seeds one active admin. Without this a fresh deployment has a sign-in page
 * and no accounts to sign in with — a lockout that looks exactly like a broken
 * build.
 */
export async function ensureBootstrapAdmin() {
  const rows = await listRecords(USERS);
  if (rows.length > 0) return null;

  const password = process.env.ADMIN_PASSWORD;
  if (passwordProblem(password)) {
    console.warn("[crm] no accounts exist and ADMIN_PASSWORD is unusable — nobody can sign in.");
    return null;
  }

  const email = normaliseEmail(process.env.ADMIN_EMAIL || "info@yaadigo.com");
  const user = await createRecord(USERS, {
    name: "Administrator",
    email,
    role: "admin",
    permissions: ["*"],
    status: "active",
    passwordHash: await hashPassword(password),
    googleId: null,
    monthlyTarget: null,
    lastSignInAt: null,
    approvedAt: new Date().toISOString(),
  });

  console.info(`[crm] seeded the first admin: ${email} (password: ADMIN_PASSWORD). Change it in Team.`);
  return publicUser(user);
}
