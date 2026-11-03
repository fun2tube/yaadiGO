import { importCodeTrips } from "@/lib/cms/trip-import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Data tasks that must run once after a deploy and are safe to run again:
 * deploy/setup-vps.sh calls this from inside the app container after every
 * start. Each task does nothing once its work is done.
 *
 *   trips   move the trips still defined in code into the `trips` table
 *
 * Gated by CRON_SECRET like /api/cron/follow-ups: closed, not open, when the
 * secret is missing.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ message: "CRON_SECRET is not set. This endpoint stays closed until it is." }, { status: 503 });
  }
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (provided !== secret) return Response.json({ message: "Not authorised." }, { status: 401 });

  try {
    const trips = await importCodeTrips();
    console.info("[maintenance] trips", JSON.stringify({ moved: trips.moved.length, skipped: trips.skipped.length, failed: trips.failed }));
    return Response.json({ ok: trips.failed.length === 0, trips }, { status: trips.failed.length ? 500 : 200 });
  } catch (error) {
    console.error("[maintenance] failed", error);
    return Response.json({ ok: false, message: String(error?.message ?? error) }, { status: 500 });
  }
}
