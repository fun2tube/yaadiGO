import "server-only";

import { listRecords, updateRecord } from "@/lib/cms/records";
import { OUTBOX, deliverQueued, channelStatus } from "@/lib/crm/notifications";

/**
 * Retry the messages that did not go out.
 *
 * Without this, a message that failed once stayed failed forever. The outbox
 * recorded it honestly — `status: "failed"` with a reason — and then nothing
 * ever looked at it again, so a thirty-second provider outage silently cost a
 * customer their quotation link. The record was accurate and useless.
 *
 * Two states are worth retrying and they mean different things:
 *
 *   `pending` — written when NO provider was configured. These are not
 *   failures; they are messages waiting for `SMTP_URL` to exist. The moment it
 *   does, this worker delivers the backlog, which is why configuring email is a
 *   one-line change rather than a one-line change plus a lost week of
 *   notifications.
 *
 *   `failed`  — a provider refused or the network dropped. Retried on a
 *   widening delay.
 */

/**
 * Minutes before attempt N is allowed. Exponential, capped at a day.
 *
 * Capped rather than unbounded because the common failure here is a provider
 * outage measured in minutes, and the uncommon one is a permanently bad address
 * — which `MAX_ATTEMPTS` handles. A backoff stretching to a week serves
 * neither.
 */
const BACKOFF_MINUTES = [0, 1, 5, 20, 60, 360, 1440];
const MAX_ATTEMPTS = 6;

export function nextAttemptAt(row) {
  const attempts = Number(row.attempts) || 0;
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
  const since = new Date(row.lastAttemptAt ?? row.createdAt ?? 0).getTime();
  return since + minutes * 60000;
}

/** Is this row due for another go? */
export function isDue(row, now = Date.now()) {
  if (row.status === "sent") return false;
  if (row.status === "pending") return true; // waiting on configuration, not a failure
  if (row.status !== "failed" && row.status !== "queued") return false;
  if ((Number(row.attempts) || 0) >= MAX_ATTEMPTS) return false;
  return nextAttemptAt(row) <= now;
}

/**
 * Run the queue. Safe to call as often as you like.
 *
 * Each row is attempted at most once per run and its attempt count is written
 * before the send, so a worker that dies mid-delivery cannot leave a row that
 * retries forever at zero attempts.
 */
export async function runOutbox({ now = Date.now(), limit = 50 } = {}) {
  const rows = await listRecords(OUTBOX);

  /**
   * A channel with no provider is SKIPPED, not attempted.
   *
   * Caught by running this for real: 17 messages were sitting `pending`
   * because no email provider is configured, and the first run attempted all
   * 17, failed all 17 and charged each one an attempt. Six cron runs later the
   * entire backlog would have been `abandoned` — **before anybody had a chance
   * to set SMTP_URL**, which is the exact scenario the pending state exists to
   * survive.
   *
   * Waiting on configuration is not a delivery failure, and must not be
   * counted as one.
   */
  const channels = channelStatus();
  const usable = (row) =>
    row.channel === "email"
      ? Boolean(channels.email?.configured)
      : Boolean(channels.whatsapp?.configured);

  const waiting = rows.filter((row) => isDue(row, now) && !usable(row));
  const due = rows.filter((row) => isDue(row, now) && usable(row)).slice(0, limit);

  const result = {
    considered: rows.length,
    due: due.length,
    // Reported rather than hidden: "17 waiting for a provider" is the number
    // that tells somebody to go and configure one.
    waitingForProvider: waiting.length,
    sent: 0,
    failed: 0,
    gaveUp: 0,
  };

  for (const row of due) {
    const attempts = (Number(row.attempts) || 0) + 1;

    // Written BEFORE the attempt. If delivery throws in a way we do not catch,
    // the row has still used an attempt — the alternative is a message that
    // retries every minute forever because the counter never advanced.
    await updateRecord(OUTBOX, row.id, {
      attempts,
      lastAttemptAt: new Date(now).toISOString(),
    });

    try {
      await deliverQueued(row);
      await updateRecord(OUTBOX, row.id, {
        status: "sent",
        sentAt: new Date(now).toISOString(),
        reason: null,
      });
      result.sent += 1;
    } catch (error) {
      const message = String(error?.message ?? error).slice(0, 300);
      const exhausted = attempts >= MAX_ATTEMPTS;

      await updateRecord(OUTBOX, row.id, {
        // A distinct terminal state, so "we are still trying" and "nobody will
        // ever receive this" are not the same word on the outbox screen.
        status: exhausted ? "abandoned" : "failed",
        reason: exhausted ? `Gave up after ${attempts} attempts — ${message}` : message,
      });

      if (exhausted) {
        console.error(`[outbox] gave up on ${row.channel} to ${row.to} — ${message}`);
        result.gaveUp += 1;
      } else {
        result.failed += 1;
      }
    }
  }

  return result;
}
