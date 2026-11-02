import { exchange, isConfigured, readState } from "@/lib/cms/google";
import { startSession } from "@/lib/cms/auth";
import { ensureBootstrapAdmin, findForGoogle, recordSignIn } from "@/lib/cms/users";

export const dynamic = "force-dynamic";

function back(request, error) {
  const url = new URL("/admin/login", request.url);
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}

export async function GET(request) {
  if (!isConfigured()) return back(request, "google-unconfigured");

  const params = new URL(request.url).searchParams;

  // The user pressed Cancel on Google's screen. Not an error worth shouting
  // about — send them back to the form.
  if (params.get("error")) return back(request, null);

  const code = params.get("code");
  const state = readState(params.get("state"));

  // A missing or bad state is the CSRF case: someone tried to complete a sign
  // in this browser never started.
  if (!code || !state) return back(request, "google-state");

  await ensureBootstrapAdmin();

  let identity;
  try {
    identity = await exchange(request, code);
  } catch (error) {
    console.error("[auth] google exchange failed", error);
    return back(request, "google-failed");
  }

  const result = await findForGoogle(identity);

  // Refused rather than registered. Google proves who someone is, not that
  // they belong here — see the note in users.js.
  if (result.error === "unknown") return back(request, "google-unknown");
  if (result.error === "suspended") return back(request, "suspended");

  const user = result.user;
  if (user.status === "pending") return back(request, "pending");
  if (user.status !== "active") return back(request, "pending");

  await recordSignIn(user.id);
  await startSession(user.id);

  return Response.redirect(new URL(state.next, request.url), 303);
}
