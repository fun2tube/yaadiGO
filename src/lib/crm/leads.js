import "server-only";

import { createRecord, getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { listUsers } from "@/lib/cms/users";
import {
  LEAD_STAGE_VALUES,
  LOST_REASONS,
  OPEN_LEAD_STAGES,
  callOutcome,
} from "@/lib/crm/schema";
import { emit, timelineFor } from "@/lib/crm/events";
import { currentVisitId, trackServerEvent } from "@/lib/analytics/visit";
import { normaliseBrief, briefGaps, briefSummary, travellerSummary } from "@/lib/crm/brief";

/**
 * The lead lifecycle.
 *
 * A lead is the customer's intent. It owns the conversation and the
 * attribution; the quotation and the booking hang off it. Every change goes
 * through this module so the event log stays complete — a status quietly
 * patched elsewhere is a gap in every report that reads the log.
 */

export const LEADS = "leads";

function contactOf(lead) {
  return {
    customerName: lead.name ?? null,
    customerEmail: lead.email ?? null,
    customerPhone: lead.phone ?? null,
  };
}

function metaFor(lead, actor, extra = {}) {
  return {
    leadId: lead.id,
    ownerId: lead.ownerId ?? null,
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? null,
    ...extra,
  };
}

/**
 * Round-robin assignment across active salespeople.
 *
 * Deliberately simple and deliberately automatic: an unassigned lead is a lead
 * nobody feels responsible for, and "the desk will pick it up" is how enquiries
 * go cold overnight. Least-loaded rather than strict rotation, so someone
 * returning from leave does not get buried.
 */
async function pickOwner() {
  const active = await listUsers();

  // Sales first. Failing that, anyone who can work a lead — on a new install
  // the only account is the admin, and an unowned lead belongs to nobody,
  // appears on no personal list, and is the one that goes cold overnight.
  // Somebody senior holding it is strictly better than the floor.
  const staff = active.filter((u) => u.role === "sales");
  const fallback = active.filter((u) => ["manager", "admin"].includes(u.role));
  const pool = staff.length > 0 ? staff : fallback;
  if (pool.length === 0) return null;

  const rows = await listRecords(LEADS);
  const load = new Map(pool.map((u) => [u.id, 0]));
  for (const lead of rows) {
    if (!OPEN_LEAD_STAGES.includes(lead.status ?? "new")) continue;
    if (load.has(lead.ownerId)) load.set(lead.ownerId, load.get(lead.ownerId) + 1);
  }

  return [...load.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

/**
 * Capture an enquiry from the public site.
 *
 * Called by the enquiry server action, so it must never throw in a way that
 * loses the lead — the caller already treats a failure here as worth telling
 * the visitor about, and everything after the record is written is a copy.
 */
/** Digits only, last 10 — so +91 98765 43210 and 09876543210 are one person. */
function phoneKey(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

const DUPLICATE_WINDOW_DAYS = 90;

/**
 * Has this person already enquired?
 *
 * Travellers enquire more than once — from the planner, then the contact form a
 * week later, then a trip page. Without this each one became a separate lead,
 * probably assigned to a different salesperson, and **two people would call the
 * same customer about the same trip.** It is the most visible way to look
 * disorganised.
 *
 * Matched on the last ten digits of the phone, or the email, within 90 days.
 * Closed leads are excluded on purpose: someone who enquired, went quiet and
 * came back six weeks later is a fresh opportunity, not an old one reopened.
 */
async function findRecentDuplicate(enquiry) {
  const key = phoneKey(enquiry.phone);
  const email = String(enquiry.email ?? "").trim().toLowerCase() || null;
  if (!key && !email) return null;

  const cutoff = Date.now() - DUPLICATE_WINDOW_DAYS * 86400000;
  const rows = await listRecords(LEADS);

  return (
    rows
      .filter((lead) => {
        if (!OPEN_LEAD_STAGES.includes(lead.status ?? "new")) return false;
        const created = new Date(lead.createdAt ?? 0).getTime();
        if (Number.isFinite(created) && created < cutoff) return false;
        if (key && phoneKey(lead.phone) === key) return true;
        return Boolean(email) && String(lead.email ?? "").trim().toLowerCase() === email;
      })
      // Newest first, so a repeat attaches to the most recent conversation.
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0] ?? null
  );
}

/**
 * Roughly what this lead is worth, at capture.
 *
 * `value` used to be null until a quotation existed, which meant the pipeline
 * could not be totalled or sorted by size — a ₹4,00,000 family trip and a
 * ₹25,000 solo enquiry looked identical in the queue.
 *
 * The midpoint of the stated budget band × group size. **Wrong but useful beats
 * absent**, and it is replaced by the real figure the moment a quotation is
 * priced. Returns null when the enquiry stated no budget, because a guessed
 * number with nothing behind it is worse than an empty cell.
 */
const BAND_MIDPOINTS = {
  shoestring: 20000,
  comfortable: 37500,
  premium: 75000,
  luxury: 125000,
};

export function estimateLeadValue(enquiry) {
  const heads = Math.max(1, Number(enquiry.groupSize) || 1);

  // The form posts the LABEL ("₹25,000 – ₹50,000"), the planner posts the key.
  const raw = String(enquiry.budget ?? "").toLowerCase();

  const key =
    Object.keys(BAND_MIDPOINTS).find((k) => raw.includes(k)) ??
    (raw.includes("1,00,000") && raw.includes("above")
      ? "luxury"
      : raw.includes("50,000") && raw.includes("1,00,000")
        ? "premium"
        : raw.includes("25,000") && raw.includes("50,000")
          ? "comfortable"
          : raw.includes("under") && raw.includes("25,000")
            ? "shoestring"
            : null);

  if (key) return BAND_MIDPOINTS[key] * heads;

  /**
   * No band matched — so this came from a CONVERSATION, where somebody says
   * "around 30000 each" or "about 1.5 lakh total" rather than picking an
   * option. Without this those became null, losing a genuinely useful number.
   *
   * It runs AFTER the band lookup, not before, and that order is load-bearing:
   * the form's own label is "₹25,000 – ₹50,000", which contains digits. Parsing
   * first grabbed 25,000 out of the label and ignored the band — the existing
   * test caught it, which is the whole reason that test exists.
   *
   * Read as per-person unless the words say otherwise, because that is how
   * Indian travellers quote a trip budget by default.
   */
  const lakh = raw.match(/([\d.]+)\s*(?:lakh|lac)\b/);
  const plain = raw.replace(/[,₹\s]/g, "").match(/(\d{4,8})/);
  const stated = lakh ? Number(lakh[1]) * 100000 : plain ? Number(plain[1]) : null;

  if (!Number.isFinite(stated) || stated <= 0) return null;

  const forGroup = /\btotal\b|\bfor all\b|\ball of us\b|\baltogether\b|\bbetween us\b/.test(raw);
  return forGroup ? Math.round(stated) : Math.round(stated) * heads;
}

export async function captureLead(enquiry) {
  // The website visit this enquiry came from, if any: what ties the lead (and
  // later the booking's money) to the channel that brought the customer.
  const visitId = enquiry.visitId ?? (await currentVisitId());
  const source = enquiry.source ?? "unknown";

  // A repeat enquiry becomes an interaction on the lead that already exists,
  // never a second lead.
  const duplicate = await findRecentDuplicate(enquiry);
  if (duplicate) {
    await trackServerEvent(visitId, "enquiry_submitted", { form: source, repeat: true });
    const summary = [enquiry.destination, enquiry.dates, enquiry.message]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 400);

    const updated = await updateRecord(LEADS, duplicate.id, {
      notes: [
        ...(duplicate.notes ?? []),
        {
          body: `Enquired again via ${enquiry.source ?? "the website"}${summary ? ` — ${summary}` : ""}`,
          at: new Date().toISOString(),
          byId: null,
          byName: "Website",
        },
      ],
      // A second enquiry is a buying signal, so it goes back to the top of the
      // owner's list regardless of what the follow-up date said.
      followUpAt: new Date().toISOString(),
      // Keep anything newly supplied without overwriting what we already had.
      itinerary: enquiry.itinerary ?? duplicate.itinerary ?? null,
      email: duplicate.email ?? enquiry.email ?? null,
      phone: duplicate.phone ?? enquiry.phone ?? null,
    });

    await emit(
      "lead.repeat",
      {
        ...contactOf(updated),
        source: enquiry.source ?? null,
        destination: enquiry.destination ?? null,
        summary: `Enquired again — ${summary || "no details"}`,
      },
      { leadId: updated.id, ownerId: updated.ownerId ?? null }
    );

    return updated;
  }

  const ownerId = await pickOwner();

  const lead = await createRecord(LEADS, {
    ...enquiry,
    visitId,
    status: "new",
    ownerId,
    notes: [],
    lostReason: null,
    // The field the entire sales workspace depends on. A new lead is due
    // TODAY: an enquiry that sits untouched overnight is the one that goes to
    // a competitor, so the default has to create urgency rather than wait for
    // someone to set a date.
    followUpAt: new Date().toISOString(),
    // Set when a quotation is approved or a booking is made, so the reports
    // can measure time-to-convert without replaying the whole log.
    convertedAt: null,
    // Estimated from the budget band × group size, so the pipeline can be
    // totalled and worked biggest-first from the moment the lead lands. The
    // real figure replaces it as soon as a quotation is priced.
    value: estimateLeadValue(enquiry),
  });

  await emit(
    "lead.created",
    {
      ...contactOf(lead),
      source: lead.source,
      destination: lead.destination,
      summary: [lead.destination, lead.dates, lead.groupSize ? `${lead.groupSize} travellers` : null]
        .filter(Boolean)
        .join(" · "),
      customerMessage:
        "Thanks — we have your enquiry. A travel expert will be in touch shortly with options.",
      hasItinerary: Boolean(lead.itinerary),
    },
    { leadId: lead.id, ownerId }
  );

  if (ownerId) {
    await emit("lead.assigned", contactOf(lead), { leadId: lead.id, ownerId });
  }

  await trackServerEvent(visitId, "enquiry_submitted", { form: source, leadId: lead.id });

  return lead;
}

export async function listLeads({ ownerId, stages, search } = {}) {
  const rows = await listRecords(LEADS);
  const wanted = stages ? new Set(stages) : null;
  const needle = search?.trim().toLowerCase();

  return rows
    .filter((lead) => {
      if (ownerId && lead.ownerId !== ownerId) return false;
      if (wanted && !wanted.has(lead.status ?? "new")) return false;
      if (needle) {
        const hay = `${lead.name ?? ""} ${lead.phone ?? ""} ${lead.email ?? ""} ${
          lead.destination ?? ""
        } ${lead.company ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) =>
      String(b.receivedAt ?? b.createdAt).localeCompare(String(a.receivedAt ?? a.createdAt))
    );
}

export async function getLead(id) {
  return getRecord(LEADS, id);
}

/** A lead with everything hanging off it — for the detail screen. */
export async function getLeadDossier(id) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return null;

  const [quotations, bookings, timeline] = await Promise.all([
    listRecords("quotations").then((rows) => rows.filter((q) => q.leadId === id)),
    listRecords("bookings").then((rows) => rows.filter((b) => b.leadId === id)),
    timelineFor({ leadId: id }),
  ]);

  return { lead, quotations, bookings, timeline };
}

export async function setStage(id, status, { actor, lostReason, note, followUpAt } = {}) {
  if (!LEAD_STAGE_VALUES.includes(status)) return { error: "Unknown stage." };

  const lead = await getRecord(LEADS, id);
  if (!lead) return { error: "No such lead." };
  if (lead.status === status) return { lead };

  // A lost lead without a reason is a hole in the reporting: "why do we lose
  // deals" is the question this data exists to answer.
  if (status === "lost" && !LOST_REASONS.includes(lostReason)) {
    return { error: "Choose why this lead was lost." };
  }

  const patch = { status, lostReason: status === "lost" ? lostReason : null };

  // Closing a lead clears the follow-up; anything else keeps or moves it.
  // A won or lost lead sitting in someone's "overdue" list forever is how a
  // useful list becomes one people stop opening.
  if (status === "won" || status === "lost") patch.followUpAt = null;
  else if (followUpAt !== undefined) patch.followUpAt = followUpAt || null;
  if (note?.trim()) {
    patch.notes = [
      ...(lead.notes ?? []),
      { body: note.trim(), at: new Date().toISOString(), byId: actor?.id ?? null, byName: actor?.name ?? null },
    ];
  }
  if (status === "won" && !lead.convertedAt) patch.convertedAt = new Date().toISOString();

  const updated = await updateRecord(LEADS, id, patch);

  await emit(
    "lead.stage",
    {
      ...contactOf(updated),
      from: lead.status ?? "new",
      to: status,
      lostReason: patch.lostReason,
      summary: `${lead.status ?? "new"} → ${status}`,
    },
    metaFor(updated, actor)
  );

  return { lead: updated };
}

export async function assign(id, ownerId, { actor } = {}) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return { error: "No such lead." };

  const updated = await updateRecord(LEADS, id, { ownerId });

  await emit("lead.assigned", { ...contactOf(updated), previousOwnerId: lead.ownerId ?? null }, {
    leadId: id,
    ownerId,
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? null,
  });

  return { lead: updated };
}

/**
 * Set or clear when this lead is next due.
 *
 * Separate from setStage because the two happen independently: "ring back
 * Thursday" does not always mean the stage moved.
 */
export async function setFollowUp(id, followUpAt, { actor } = {}) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return { error: "No such lead." };

  const updated = await updateRecord(LEADS, id, { followUpAt: followUpAt || null });

  await emit(
    "lead.followup",
    {
      ...contactOf(updated),
      summary: followUpAt
        ? `Follow up ${new Date(followUpAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
        : "Follow-up cleared",
    },
    metaFor(updated, actor)
  );

  return { lead: updated };
}

/**
 * Save the structured trip brief.
 *
 * This is the step that makes a two-minute quotation possible. The public
 * forms capture what the customer typed — "mid-June, flexible", "around
 * 40-50k" — and those stay untouched in `dates` and `budget`, because the
 * customer's own words are worth keeping. What the salesperson CONFIRMS on the
 * call lands here, structured, so the quotation builder can read it instead of
 * asking again.
 *
 * Everything is optional and saved incrementally. A brief is filled in during
 * a phone call, not in one sitting, and a form that refuses to save until it
 * is complete is a form that gets abandoned halfway and loses the first half.
 */
export async function updateBrief(id, patch, { actor } = {}) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return { error: "No such lead." };

  const next = {};

  if ("departureDate" in patch) next.departureDate = patch.departureDate || null;
  if ("returnDate" in patch) next.returnDate = patch.returnDate || null;
  if ("departureFlexible" in patch) next.departureFlexible = Boolean(patch.departureFlexible);

  if ("adults" in patch) next.adults = patch.adults === null ? null : Math.max(0, Number(patch.adults) || 0);
  if ("infants" in patch) next.infants = Math.max(0, Number(patch.infants) || 0);
  if ("children" in patch) {
    // The AGE is the payload — a count cannot price a 4-year-old and an
    // 11-year-old differently, and every Indian hotel does.
    next.children = (Array.isArray(patch.children) ? patch.children : [])
      .map((child) => ({ age: Math.max(0, Math.min(17, Number(child?.age) || 0)) }))
      .slice(0, 12);
  }

  if ("budgetAmount" in patch) {
    next.budgetAmount = patch.budgetAmount === null ? null : Math.max(0, Number(patch.budgetAmount) || 0);
  }
  if ("budgetPerPerson" in patch) next.budgetPerPerson = Boolean(patch.budgetPerPerson);

  // Normalised on the way in, so an unknown enum from a stale client or a
  // hand-edited row never reaches the database.
  if ("brief" in patch) next.brief = normaliseBrief(patch.brief);

  if (Object.keys(next).length === 0) return { error: "Nothing to change." };

  const updated = await updateRecord(LEADS, id, next);

  // Only logged when the headline facts move. A brief is edited repeatedly
  // during one call, and an event per keystroke buries the timeline.
  const movedDate = "departureDate" in next && next.departureDate !== lead.departureDate;
  const movedPax = "adults" in next || "children" in next || "infants" in next;
  if (movedDate || movedPax || "brief" in next) {
    const bits = [
      updated.departureDate
        ? `Departs ${updated.departureDate}${updated.departureFlexible ? " (flexible)" : ""}`
        : null,
      travellerSummary(updated) || null,
      briefSummary(updated.brief) || null,
    ].filter(Boolean);
    await emit(
      "lead.brief",
      { ...contactOf(updated), summary: bits.join(" · ") || "Brief updated" },
      metaFor(updated, actor)
    );
  }

  return { lead: updated, gaps: briefGaps(updated) };
}

/**
 * Hand a lead to a colleague.
 *
 * The reason is mandatory. An unexplained reassignment reads as blame to the
 * person losing it, and the person receiving it needs to know what was already
 * tried — otherwise they open with the same question the customer has already
 * answered twice.
 */
export async function transfer(id, toUserId, { actor, reason } = {}) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return { error: "No such lead." };
  if (!reason?.trim()) return { error: "Say why you are transferring it." };
  if (lead.ownerId === toUserId) return { error: "They already own this lead." };

  const staff = await listUsers();
  const to = staff.find((u) => u.id === toUserId);
  if (!to) return { error: "No such team member." };

  const from = staff.find((u) => u.id === lead.ownerId);

  const note = {
    body: `Transferred from ${from?.name ?? "unassigned"} to ${to.name}: ${reason.trim()}`,
    at: new Date().toISOString(),
    byId: actor?.id ?? null,
    byName: actor?.name ?? null,
  };

  const updated = await updateRecord(LEADS, id, {
    ownerId: toUserId,
    notes: [...(lead.notes ?? []), note],
  });

  // Emitted against the NEW owner, so it lands in their notifications rather
  // than telling the person who just gave it away.
  await emit(
    "lead.assigned",
    {
      ...contactOf(updated),
      previousOwnerId: lead.ownerId ?? null,
      previousOwnerName: from?.name ?? null,
      reason: reason.trim(),
      summary: `From ${from?.name ?? "unassigned"} — ${reason.trim()}`,
    },
    {
      leadId: id,
      ownerId: toUserId,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
    }
  );

  return { lead: updated };
}

/**
 * Log a call in one action, and set the next follow-up from the outcome.
 *
 * The thing this fixes: the next follow-up date was set by hand, separately,
 * every single time — so under pressure it was not set at all, and the lead
 * fell out of My Day silently. Here the outcome implies the date, so logging
 * what happened and deciding when to try again are one tap.
 *
 * The call is recorded on the lead as structured data as well as a note, which
 * is what makes "dials per booking" and "connect rate per salesperson"
 * answerable at all.
 */
export async function logCall(id, { outcome, note, followUpAt, actor } = {}) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return { error: "No such lead." };

  const spec = callOutcome(outcome);
  if (!spec) return { error: "Choose what happened on the call." };

  // A booked callback without the customer's date is the one case where
  // guessing would be worse than refusing — they named a time.
  if (spec.needsDate && !followUpAt) {
    return { error: "When did they ask you to call back?" };
  }

  const now = new Date();
  const next =
    followUpAt ??
    (spec.nextDays === null
      ? null
      : new Date(now.getTime() + spec.nextDays * 86400000).toISOString());

  const call = {
    outcome,
    at: now.toISOString(),
    byId: actor?.id ?? null,
    byName: actor?.name ?? null,
    note: note?.trim() || null,
  };

  const patch = {
    calls: [...(lead.calls ?? []), call],
    notes: [
      ...(lead.notes ?? []),
      {
        body: note?.trim() ? `${spec.label} — ${note.trim()}` : spec.label,
        at: now.toISOString(),
        byId: actor?.id ?? null,
        byName: actor?.name ?? null,
      },
    ],
  };

  // Only touch the follow-up when the outcome has an opinion. A wrong number
  // must not keep reappearing in My Day, and clearing the date is how it stops.
  if (next !== null) patch.followUpAt = next;
  else if (spec.value === "wrong-number") patch.followUpAt = null;

  const updated = await updateRecord(LEADS, id, patch);

  await emit(
    "lead.call",
    {
      ...contactOf(updated),
      outcome,
      summary: `${spec.label}${note?.trim() ? ` — ${note.trim().slice(0, 100)}` : ""}`,
    },
    metaFor(updated, actor)
  );

  return {
    lead: updated,
    // Surfaced so the UI can prompt rather than decide — "not interested"
    // should offer to mark the lead lost, never do it silently.
    suggestsLost: Boolean(spec.suggestsLost),
  };
}

export async function addNote(id, body, { actor } = {}) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return { error: "No such lead." };

  const note = {
    body: body.trim(),
    at: new Date().toISOString(),
    byId: actor?.id ?? null,
    byName: actor?.name ?? null,
  };

  const updated = await updateRecord(LEADS, id, { notes: [...(lead.notes ?? []), note] });

  // Notes are logged but nobody is notified: a salesperson writing "called,
  // no answer" should not ping the whole team.
  await emit("lead.note", { ...contactOf(updated), summary: note.body.slice(0, 140) }, metaFor(updated, actor));

  return { lead: updated };
}

/** Mark a lead won and stamp the value the booking realised. */
export async function markConverted(id, { value, actor, bookingId } = {}) {
  const lead = await getRecord(LEADS, id);
  if (!lead) return null;

  return updateRecord(LEADS, id, {
    status: "won",
    value: Number(value) || lead.value || null,
    convertedAt: lead.convertedAt ?? new Date().toISOString(),
    bookingId: bookingId ?? lead.bookingId ?? null,
  });
}
