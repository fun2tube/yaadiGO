import { getDb } from "@/db";
import { recordSiteEvent, visitExists } from "@/db/analytics";

/**
 * The website visit behind the current request, for tying a lead to the
 * channel that produced it. The browser tracker (src/instrumentation-client.js)
 * keeps the visit id in a `yg_sid` cookie.
 *
 * Null whenever there is no visit to name: no request (a script or a test),
 * no cookie (tracking blocked, a phone enquiry typed in by staff), or an id
 * the database never saw. A lead must never fail because of analytics.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function currentVisitId() {
  try {
    const { cookies } = await import("next/headers");
    const id = (await cookies()).get("yg_sid")?.value;
    if (!id || !UUID.test(id)) return null;
    const db = getDb();
    if (!db) return null;
    return (await visitExists(db, id)) ? id : null;
  } catch {
    return null;
  }
}

/** Record a website event on a visit, never throwing. */
export async function trackServerEvent(visitId, name, props = {}) {
  try {
    const db = getDb();
    if (!db) return;
    await recordSiteEvent(db, { visitId, name, props });
  } catch (error) {
    console.error(`[analytics] could not record ${name}:`, error?.message ?? error);
  }
}
