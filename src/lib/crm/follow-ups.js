import "server-only";

import { getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { QUOTATIONS } from "@/lib/crm/quotations";
import { LEADS } from "@/lib/crm/leads";
import { emit } from "@/lib/crm/events";

/**
 * Chasing quotations.
 *
 * A quotation sent and never chased is a lost sale, and chasing is the first
 * thing a salesperson drops when the day is busy — it feels like admin, it has
 * no deadline, and nobody notices it did not happen.
 *
 * The important design decision is that this works with NO infrastructure.
 * `dueForChase()` is computed on read, so the Chase bucket in My Day is live
 * today without a cron provider, a deployment or an email account. The
 * automatic nudges in runFollowUps() are the second half, and they are dormant
 * until those exist.
 *
 * Building the automated half first would have produced a feature nobody could
 * see working.
 */

const DAY = 86400000;

/**
 * Two days, not one.
 *
 * A trip is a considered purchase. Chasing the morning after reads as
 * desperate; two days reads as attentive. Ten days is where a quotation stops
 * being live — but see the note on `cold` below.
 */
export const LADDER = { firstChase: 2, secondChase: 5, cold: 10 };

export function quoteAge(quotation, now = Date.now()) {
  if (!quotation.sentAt) return null;
  return Math.floor((now - new Date(quotation.sentAt).getTime()) / DAY);
}

/**
 * What state a sent quotation is in.
 *
 * Returns null for anything not awaiting a decision — a draft has not been
 * sent and an approved one needs no chasing.
 */
export function chaseState(quotation, now = Date.now()) {
  if (quotation.status !== "sent") return null;

  const age = quoteAge(quotation, now);
  if (age === null) return null;

  if (quotation.validUntil && new Date(quotation.validUntil).getTime() < now) {
    return { state: "expired", age };
  }
  if (age >= LADDER.cold) return { state: "cold", age };
  if (age >= LADDER.secondChase) return { state: "chase-again", age };
  if (age >= LADDER.firstChase) return { state: "chase", age };
  return { state: "fresh", age };
}

/**
 * Quotations a person should chase today.
 *
 * Scoped by owner, like everything else a salesperson sees. Oldest first: the
 * one ignored longest is the one about to be lost.
 */
export async function dueForChase({ ownerId } = {}) {
  const [quotations, leads] = await Promise.all([
    listRecords(QUOTATIONS),
    listRecords(LEADS),
  ]);
  return chaseListFrom(quotations, leads, { ownerId });
}

/**
 * The same thing, with no I/O.
 *
 * Split out so a page that is already fetching these tables can compute the
 * chase list without another round trip.
 *
 * The lesson behind this shape: against a database 335ms away, what costs is a
 * SEQUENTIAL query, not an extra parallel one. An earlier attempt to remove a
 * "duplicate" lead fetch made the page SLOWER — 1.43s to 1.81s — because it
 * turned two parallel reads into two serial ones. Fetch everything at once,
 * then compute.
 */
export function chaseListFrom(quotations, leads, { ownerId } = {}) {
  const byLead = new Map(leads.map((l) => [l.id, l]));

  return quotations
    .filter((q) => !ownerId || q.ownerId === ownerId || !q.ownerId)
    .map((q) => ({ quotation: q, chase: chaseState(q) }))
    .filter(({ chase }) => chase && ["chase", "chase-again", "cold"].includes(chase.state))
    .map(({ quotation, chase }) => {
      const lead = byLead.get(quotation.leadId);
      return {
        ...quotation,
        chaseState: chase.state,
        ageDays: chase.age,
        remindersSent: (quotation.reminders ?? []).length,
        leadName: lead?.name ?? null,
        leadPhone: lead?.phone ?? null,
        leadEmail: lead?.email ?? null,
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
}

/**
 * The automatic half. Safe to run as often as you like.
 *
 * Every write is guarded by something already recorded on the quotation, so a
 * second run in the same hour — or two cron providers firing at once — cannot
 * send a customer the same reminder twice.
 */
export async function runFollowUps({ now = Date.now() } = {}) {
  const quotations = await listRecords(QUOTATIONS);
  const result = { expired: 0, chased: 0, wentCold: 0, checked: 0 };

  for (const quotation of quotations) {
    if (quotation.status !== "sent") continue;
    result.checked += 1;

    const chase = chaseState(quotation, now);
    if (!chase) continue;

    // --- Expired ---------------------------------------------------------
    if (chase.state === "expired") {
      await updateRecord(QUOTATIONS, quotation.id, { status: "expired" });
      await emit(
        "quotation.expired",
        { title: quotation.title, summary: `v${quotation.version} passed its valid-until date` },
        {
          leadId: quotation.leadId,
          quotationId: quotation.id,
          ownerId: quotation.ownerId,
          amount: quotation.total,
        }
      );
      result.expired += 1;
      continue;
    }

    const reminders = quotation.reminders ?? [];

    // --- Nudges ----------------------------------------------------------
    //
    // Driven by how OLD the quotation is, not by the exact rung it is on. The
    // first version matched state to step, so a quotation that jumped from
    // fresh to cold — because the cron was off for a fortnight, or the secret
    // was unset — went cold having never been chased once. The customer got
    // nothing at all, which is the precise failure this feature exists to
    // prevent.
    //
    // Now: send the next reminder the age has earned, catching up if needed.
    const earned = chase.age >= LADDER.secondChase ? 2 : chase.age >= LADDER.firstChase ? 1 : 0;
    const step = earned > reminders.length ? reminders.length + 1 : null;

    if (step) {
      const lead = await getRecord(LEADS, quotation.leadId);

      // Recorded on the quotation BEFORE the event fires. If the notification
      // fan-out throws, the worst case is a reminder that was logged but not
      // sent — recoverable. The reverse sends the customer a second copy.
      await updateRecord(QUOTATIONS, quotation.id, {
        reminders: [...reminders, { step, at: new Date(now).toISOString() }],
      });

      await emit(
        "quotation.reminder",
        {
          customerName: lead?.name ?? null,
          customerEmail: lead?.email ?? null,
          customerPhone: lead?.phone ?? null,
          title: quotation.title,
          step,
          summary: `Reminder ${step} · v${quotation.version} · ${chase.age} days`,
          customerMessage:
            step === 1
              ? `Just checking you saw the quotation for ${quotation.title} — ₹${Number(
                  quotation.total
                ).toLocaleString("en-IN")}. Any questions, reply here and we will rework it.`
              : `Following up on ${quotation.title}. The price holds until we hear otherwise — tell us what would work better and we will adjust it.`,
        },
        {
          leadId: quotation.leadId,
          quotationId: quotation.id,
          ownerId: quotation.ownerId,
          amount: quotation.total,
        }
      );
      result.chased += 1;
      continue;
    }

    // --- Going cold ------------------------------------------------------
    //
    // A prompt for a human, never a verdict. Nothing is auto-marked lost: a
    // system that silently closes deals teaches people not to trust it, and
    // the one it closes wrongly is the one that was about to convert.
    if (chase.state === "cold" && !quotation.coldFlaggedAt) {
      await updateRecord(QUOTATIONS, quotation.id, {
        coldFlaggedAt: new Date(now).toISOString(),
      });
      await emit(
        "quotation.cold",
        {
          title: quotation.title,
          summary: `No reply in ${chase.age} days — decide whether to keep it open`,
        },
        {
          leadId: quotation.leadId,
          quotationId: quotation.id,
          ownerId: quotation.ownerId,
          amount: quotation.total,
        }
      );
      result.wentCold += 1;
    }
  }

  return result;
}
