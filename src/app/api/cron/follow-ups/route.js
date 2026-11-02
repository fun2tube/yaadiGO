import "@/lib/crm";
import { runFollowUps } from "@/lib/crm/follow-ups";
import { runSlaChecks } from "@/lib/crm/sla";
import { runOutbox } from "@/lib/crm/outbox-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The scheduled chase.
 *
 * A PUBLIC URL that mutates data, so it is gated by a shared secret. A missing
 * CRON_SECRET REFUSES rather than running openly — an endpoint that silently
 * works without its guard is the one that gets found and hammered.
 *
 * Idempotent by design: every write is guarded by something already recorded
 * on the quotation, so running it twice, or two cron providers firing at once,
 * cannot send a customer the same reminder twice. Schedule it as often as you
 * like; once a day is enough.
 *
 * Vercel: add to vercel.json —
 *   { "crons": [{ "path": "/api/cron/follow-ups", "schedule": "0 4 * * *" }] }
 * and set CRON_SECRET. Vercel sends it as `Authorization: Bearer <secret>`.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return Response.json(
      {
        message:
          "CRON_SECRET is not set. This endpoint stays closed until it is — see .env.example.",
      },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");

  if (provided !== secret) {
    // Same answer for a missing and a wrong secret: nothing to probe with.
    return Response.json({ message: "Not authorised." }, { status: 401 });
  }

  // Three independent jobs, so one failing must not silently cancel the others
  // — chasing quotations, noticing an ignored lead and retrying a failed
  // message have nothing to do with each other, and losing all three because of
  // one bad record is the wrong trade.
  const [chases, sla, outbox] = await Promise.allSettled([
    runFollowUps(),
    runSlaChecks({ now: Date.now() }),
    runOutbox(),
  ]);

  const result = {
    quotations: chases.status === "fulfilled" ? chases.value : { error: String(chases.reason) },
    leads: sla.status === "fulfilled" ? sla.value : { error: String(sla.reason) },
    outbox: outbox.status === "fulfilled" ? outbox.value : { error: String(outbox.reason) },
  };

  if (chases.status === "rejected") console.error("[cron] follow-ups failed", chases.reason);
  if (sla.status === "rejected") console.error("[cron] SLA checks failed", sla.reason);
  if (outbox.status === "rejected") console.error("[cron] outbox run failed", outbox.reason);

  console.info("[cron] follow-ups", JSON.stringify(result));

  // 500 only when ALL THREE failed. A partial run did useful work and should
  // not look like an outage to whatever is watching the cron.
  const allFailed =
    chases.status === "rejected" && sla.status === "rejected" && outbox.status === "rejected";
  return Response.json({ ok: !allFailed, ...result }, { status: allFailed ? 500 : 200 });
}
