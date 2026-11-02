import "server-only";

import { createRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { captureLead } from "@/lib/crm/leads";
import { emit } from "@/lib/crm/events";

/**
 * What people asked Yaadi for.
 *
 * The gap this closes: a traveller could tell the concierge they wanted Kashmir
 * for four people in October, get live seat counts and real prices, decide to
 * think about it — and the desk never learned they existed. `hand_to_human` and
 * `start_booking` only drew a card on screen. That was the biggest lead leak in
 * the system, and it was leaking the WARMEST traffic: somebody who got as far
 * as asking about dates and seats is far closer to booking than a cold form
 * filler.
 *
 * WHY THIS IS NOT JUST A LEAD. A chat that reveals a destination and a month
 * but no phone number is a DEMAND SIGNAL, not a callable lead. Dropping those
 * into the pipeline fills a salesperson's queue with rows nobody can action,
 * and a queue full of unactionable rows is a queue people stop working.
 *
 * So interests live here, and are promoted to a real lead the moment contact
 * details appear — at which point the normal pipeline takes over, including
 * duplicate detection.
 */

export const INTERESTS = "interests";

/** One row per conversation, not per message. */
export async function recordInterest({
  conversationId,
  destination,
  month,
  travellers,
  budget,
  note,
  transcript,
}) {
  if (!conversationId) return null;

  const rows = await listRecords(INTERESTS);
  const existing = rows.find((row) => row.conversationId === conversationId);

  const patch = {
    // Never overwrite something known with something absent: the model learns
    // these across several turns, and a later turn that does not mention the
    // month must not erase the month.
    destination: destination ?? existing?.destination ?? null,
    month: month ?? existing?.month ?? null,
    travellers: travellers ?? existing?.travellers ?? null,
    budget: budget ?? existing?.budget ?? null,
    note: note ?? existing?.note ?? null,
    transcript: transcript ?? existing?.transcript ?? null,
    lastSeenAt: new Date().toISOString(),
  };

  if (existing) return updateRecord(INTERESTS, existing.id, patch);

  const created = await createRecord(INTERESTS, {
    conversationId,
    ...patch,
    leadId: null,
    firstSeenAt: new Date().toISOString(),
  });

  await emit(
    "interest.captured",
    {
      destination: patch.destination,
      summary: describeInterest(patch),
    },
    {}
  );

  return created;
}

/** One line a salesperson can read at a glance. */
export function describeInterest(interest) {
  return (
    [
      interest.destination,
      interest.month,
      interest.travellers ? `${interest.travellers} travellers` : null,
      interest.budget,
    ]
      .filter(Boolean)
      .join(" · ") || "No details given"
  );
}

/**
 * Contact details arrived — this is a real lead now.
 *
 * Goes through `captureLead` rather than writing a lead directly, so it gets
 * owner assignment, the follow-up-today default, duplicate detection and the
 * notification fan-out. A second path into the pipeline would be a second place
 * for those to be forgotten.
 */
export async function promoteInterest(conversationId, contact) {
  const rows = await listRecords(INTERESTS);
  const interest = rows.find((row) => row.conversationId === conversationId);
  if (!interest) return null;
  if (interest.leadId) return { leadId: interest.leadId, alreadyPromoted: true };

  const lead = await captureLead({
    name: contact.name ?? "Yaadi enquiry",
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    destination: interest.destination ?? null,
    dates: interest.month ?? null,
    groupSize: interest.travellers ?? null,
    budget: interest.budget ?? null,
    message: [interest.note, interest.transcript].filter(Boolean).join("\n\n").slice(0, 2000),
    source: "ask-yaadi",
  });

  await updateRecord(INTERESTS, interest.id, { leadId: lead.id, promotedAt: new Date().toISOString() });
  return { leadId: lead.id, lead };
}

/**
 * What people have been asking for, newest first.
 *
 * Unpromoted ones are the useful part: they say what to stock and what to
 * advertise, which is worth knowing even when nobody can be called.
 */
export async function listInterests({ includePromoted = false } = {}) {
  const rows = await listRecords(INTERESTS);
  return rows
    .filter((row) => includePromoted || !row.leadId)
    .sort((a, b) => String(b.lastSeenAt ?? "").localeCompare(String(a.lastSeenAt ?? "")));
}
