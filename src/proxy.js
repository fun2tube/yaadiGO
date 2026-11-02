import { NextResponse } from "next/server";

/**
 * Serves corporate.yaadigo.com from this same Next app.
 *
 * Requests arriving on the corporate host are rewritten into the /corporate
 * route tree, so the visitor sees `corporate.yaadigo.com/` while Next renders
 * `/corporate`. A rewrite, not a redirect — the subdomain stays in the
 * address bar, which is the whole point of having one.
 *
 * DNS/host setup this expects:
 *   - a CNAME for `corporate` pointing at the same deployment
 *   - the domain added to the project (on Vercel: Settings → Domains)
 *
 * `CORPORATE_HOSTS` covers local development too, because subdomains do not
 * resolve on localhost — use corporate.localhost:3000, which Chrome and
 * Firefox both route to 127.0.0.1 without editing /etc/hosts.
 */

const CORPORATE_HOSTS = ["corporate.yaadigo.com", "corporate.localhost"];

function isCorporateHost(hostname) {
  return CORPORATE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
}

export function proxy(request) {
  const pathname = request.nextUrl.pathname;

  // The admin never belongs on the corporate subdomain, and it must never be
  // indexed. The pages themselves check the session; this is belt-and-braces
  // at the edge so a misconfigured page can't leak one.
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/media") {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const url = request.nextUrl;
  // `hostname` drops the port, so corporate.localhost:3000 matches cleanly.
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";

  if (!isCorporateHost(hostname)) return NextResponse.next();

  // Already inside the corporate tree (an internal navigation) — leave it be,
  // or the path would accumulate another /corporate on every hop.
  if (url.pathname === "/corporate" || url.pathname.startsWith("/corporate/")) {
    return NextResponse.next();
  }

  // Shared routes stay shared rather than 404ing on the subdomain: a visitor
  // on corporate.yaadigo.com/privacy should get the privacy policy.
  const SHARED = ["/privacy", "/terms", "/contact", "/plan", "/blog", "/about"];
  if (SHARED.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const rewritten = url.clone();
  rewritten.pathname = `/corporate${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(rewritten);
}

export const config = {
  // Skip API routes, Next internals, and anything that looks like a file —
  // without this the rewrite would also mangle CSS, JS and image requests.
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
