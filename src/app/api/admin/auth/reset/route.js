import { z } from "zod";
import { beginPasswordReset, changePassword, completePasswordReset } from "@/lib/cms/users";
import { authorise } from "@/lib/cms/auth";
import { sendPasswordReset } from "@/lib/crm/staff-mail";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({ email: z.string().email().max(160) });
const CompleteSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10).max(200),
});
const ChangeSchema = z.object({
  current: z.string().max(200).optional(),
  next: z.string().min(10).max(200),
});

// A reset form is also an email prober and a free way to make us send mail.
const asked = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX = 5;

function tooOften(key) {
  const now = Date.now();
  const recent = (asked.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  asked.set(key, recent);
  return recent.length > MAX;
}

/** "I forgot my password." */
export async function POST(request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => ({})));

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // The SAME answer regardless of what happened — whether the address is
  // unknown, suspended, or a mail was really sent. Anything else turns this
  // endpoint into a way to enumerate who works here.
  const identical = Response.json({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });

  if (!parsed.success) return identical;
  if (tooOften(ip)) return identical;

  const started = await beginPasswordReset(parsed.data.email);
  if (!started) return identical;

  const link = new URL(`/admin/reset?token=${started.token}`, request.url).toString();
  const delivery = await sendPasswordReset({ user: started.user, link });

  if (!delivery.sent) {
    // Nowhere to send it. Logged for the developer; the response is unchanged,
    // because telling the browser would leak that the account exists.
    console.warn(`[auth] reset link for ${started.user.email} could not be emailed: ${link}`);
  }

  return identical;
}

/** "Here is my new password, from the emailed link." */
export async function PUT(request) {
  const parsed = CompleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Check the form." },
      { status: 400 }
    );
  }

  const result = await completePasswordReset(parsed.data.token, parsed.data.password);
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  // Not signed in automatically: a reset link lives in an inbox, and an inbox
  // is not proof of presence at the keyboard. They sign in with the new
  // password, which also confirms it was stored.
  return Response.json({ ok: true, message: "Password updated. Sign in with it now." });
}

/** "Change my password", from inside the panel. */
export async function PATCH(request) {
  const { user, denied } = await authorise();
  if (denied) return denied;

  const parsed = ChangeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Check the form." },
      { status: 400 }
    );
  }

  const result = await changePassword(user.id, parsed.data);
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  return Response.json({ ok: true, message: "Password changed." });
}
