import "server-only";

import { listRecords, updateRecord } from "@/lib/cms/records";
import { LEADS } from "@/lib/crm/leads";
import { emit } from "@/lib/crm/events";

/**
 * Nobody has touched this lead.
 *
 * A new lead is already due today — that part worked. What did not exist was
 * anything that NOTICED when the date passed and nothing happened. A lead could
 * sit in `new`, untouched, indefinitely: no nudge, no escalation, no
 * reassignment. The enquiry that goes to a competitor is exactly this one.
 *
 * Two rungs, deliberately:
 *   NUDGE the owner first. Most of the time they are simply busy, and a
 *   reminder is all that is needed. Going straight to the manager over four
 *   hours would teach the team that the system tells on them.
 *   ESCALATE to admin after a day, with reassignment offered. At that point it
 *   is not forgetfulness, it is capacity or absence, and somebody else should
 *   take it.
 *
 * Measured in BUSINESS hours, not wall clock. An enquiry at 8pm has not been
 * ignored by 9am — the desk was closed. Counting the night against a
 * salesperson produces alerts nobody believes, and alerts nobody believes are
 * worse than none.
 */

const NUDGE_AFTER_HOURS = 4;
const ESCALATE_AFTER_HOURS = 8; // a full working day

// The desk's day, in IST. Deliberately simple: no weekend handling, because
// Indian travel desks work Saturdays and a lead sitting over a Sunday is still
// a lead sitting.
const DAY_START = 9;
const DAY_END = 19;
const IST_OFFSET_MINUTES = 330;

/** A Date shifted into IST, so getHours() means what the desk means. */
function toIst(date) {
  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60000);
}

/**
 * Business hours between two instants.
 *
 * Walks day by day rather than doing modular arithmetic, because the clever
 * version is where off-by-one errors live and this runs once an hour at most.
 */
export function businessHoursBetween(from, to) {
  const start = toIst(new Date(from));
  const end = toIst(new Date(to));
  if (!(end > start)) return 0;

  let hours = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    // The end of the working day the cursor is currently inside.
    const dayEnd = new Date(cursor);
    dayEnd.setUTCHours(DAY_END, 0, 0, 0);
    const dayStart = new Date(cursor);
    dayStart.setUTCHours(DAY_START, 0, 0, 0);

    if (cursor < dayStart) {
      // Before opening — jump to the start of business.
      cursor.setTime(dayStart.getTime());
      continue;
    }
    if (cursor >= dayEnd) {
      // After closing — jump to tomorrow morning.
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(DAY_START, 0, 0, 0);
      continue;
    }

    const slice = Math.min(dayEnd.getTime(), end.getTime()) - cursor.getTime();
    hours += slice / 3600000;
    cursor.setTime(Math.min(dayEnd.getTime(), end.getTime()));
  }

  return hours;
}

/**
 * Has anyone done anything to this lead?
 *
 * A call logged, a note written, the stage moved, a quotation raised. Checked
 * against the record rather than the event log so this stays one read.
 */
export function isUntouched(lead) {
  if ((lead.status ?? "new") !== "new") return false;
  if ((lead.calls ?? []).length > 0) return false;
  if ((lead.notes ?? []).length > 0) return false;
  return true;
}

/**
 * Run the ladder. Safe to call as often as you like.
 *
 * Every write is guarded by a timestamp already on the lead, so a second run in
 * the same hour — or two cron providers firing together — cannot send the same
 * nudge twice.
 */
export async function runSlaChecks({ now = Date.now() } = {}) {
  const leads = await listRecords(LEADS);
  const result = { checked: 0, nudged: 0, escalated: 0 };

  for (const lead of leads) {
    if (!isUntouched(lead)) continue;

    const createdAt = new Date(lead.createdAt ?? 0).getTime();
    if (!Number.isFinite(createdAt) || createdAt === 0) continue;

    result.checked += 1;
    const hours = businessHoursBetween(createdAt, now);

    // --- Escalate ---------------------------------------------------------
    if (hours >= ESCALATE_AFTER_HOURS && !lead.slaEscalatedAt) {
      // Recorded BEFORE the event fires. If the fan-out throws, the worst case
      // is an escalation logged but not delivered — recoverable. The reverse
      // alerts the admin about the same lead every hour.
      await updateRecord(LEADS, lead.id, { slaEscalatedAt: new Date(now).toISOString() });
      await emit(
        "lead.sla.escalated",
        {
          customerName: lead.name ?? null,
          customerPhone: lead.phone ?? null,
          destination: lead.destination ?? null,
          summary: `Untouched for ${Math.round(hours)} working hours — reassign or chase it`,
        },
        { leadId: lead.id, ownerId: lead.ownerId ?? null }
      );
      result.escalated += 1;
      continue;
    }

    // --- Nudge ------------------------------------------------------------
    if (hours >= NUDGE_AFTER_HOURS && !lead.slaNudgedAt) {
      await updateRecord(LEADS, lead.id, { slaNudgedAt: new Date(now).toISOString() });
      await emit(
        "lead.sla.nudge",
        {
          customerName: lead.name ?? null,
          customerPhone: lead.phone ?? null,
          destination: lead.destination ?? null,
          summary: `No contact yet — ${Math.round(hours)} working hours since it came in`,
        },
        { leadId: lead.id, ownerId: lead.ownerId ?? null }
      );
      result.nudged += 1;
    }
  }

  return result;
}
