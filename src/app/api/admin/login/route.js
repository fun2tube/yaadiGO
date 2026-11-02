import {
  adminConfigured,
  adminConfigError,
  signIn,
  startSession,
} from "@/lib/cms/auth";
import { ensureBootstrapAdmin } from "@/lib/cms/users";

export const dynamic = "force-dynamic";

// Brute-force brake. In-memory, so per instance — enough to stop a script, and
// the note in lib/ai.js about moving rate limiting to Redis applies here too.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(key) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
}

function recordAttempt(key) {
  attempts.set(key, [...(attempts.get(key) ?? []), Date.now()]);
}

/**
 * What each failure tells the person.
 *
 * "Awaiting approval" is worth saying — they did everything right and are
 * waiting on a colleague, and without it they will keep retrying a password
 * that is correct. "No such account" is NOT said: a login form that confirms
 * which emails exist is an email prober, so a wrong password and an unknown
 * address give the same answer.
 */
const MESSAGES = {
  credentials: { status: 401, message: "That email and password don't match." },
  "not-set-up": {
    status: 403,
    message: "Your invitation hasn't been used yet — open the link in your invite email first.",
  },
  pending: {
    status: 403,
    message: "Your account is waiting for an admin to approve it. You'll get an email when it's ready.",
  },
  suspended: { status: 403, message: "That account has been suspended. Ask an admin." },
};

export async function POST(request) {
  if (!adminConfigured()) {
    return Response.json({ message: adminConfigError() }, { status: 503 });
  }

  // A fresh install has no accounts; seed one from ADMIN_PASSWORD so the
  // sign-in page is not a locked door.
  await ensureBootstrapAdmin();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { email, password } = await request.json().catch(() => ({}));

  // Keyed by IP *and* email: one person fumbling their own password should not
  // lock out an office behind a shared address, but a script walking a list of
  // emails from one IP still gets stopped.
  const key = `${ip}|${String(email ?? "").toLowerCase()}`;
  if (tooManyAttempts(key) || tooManyAttempts(ip)) {
    return Response.json({ message: "Too many attempts. Wait fifteen minutes." }, { status: 429 });
  }

  const result = await signIn(email, password);

  if (result.error) {
    recordAttempt(key);
    recordAttempt(ip);
    const { status, message } = MESSAGES[result.error] ?? MESSAGES.credentials;
    return Response.json({ message }, { status });
  }

  attempts.delete(key);
  await startSession(result.user.id);
  return Response.json({
    ok: true,
    user: { id: result.user.id, name: result.user.name, role: result.user.role },
  });
}
