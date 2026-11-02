import { authorizeUrl, isConfigured } from "@/lib/cms/google";

export const dynamic = "force-dynamic";

/** Kick off Google sign-in. GET so it can be a plain link with no JavaScript. */
export async function GET(request) {
  if (!isConfigured()) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("error", "google-unconfigured");
    return Response.redirect(url, 303);
  }

  const next = new URL(request.url).searchParams.get("next") ?? "/admin";
  return Response.redirect(authorizeUrl(request, next), 303);
}
