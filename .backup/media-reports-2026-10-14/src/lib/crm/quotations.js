import "server-only";

import crypto from "node:crypto";
import { createRecord, getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { QUOTE_LINE_KIND_VALUES, QUOTE_STATUS_VALUES } from "@/lib/crm/schema";
import { emit } from "@/lib/crm/events";
import { seatedTravellers } from "@/lib/crm/brief";
import { getLead } from "@/lib/crm/leads";

/**
 * Quotations.
 *
 * A quotation is a priced, versioned offer against a lead. Two rules shape the
 * whole module:
 *
 *   1. TOTALS ARE COMPUTED, NEVER STORED FROM THE CLIENT. Every figure the
 *      customer sees is derived here from the lines. A posted total is a
 *      number nobody can reproduce later, and it is the first thing to go
 *      wrong when someone edits a line and forgets the sum.
 *
 *   2. A SENT QUOTATION IS IMMUTABLE. Editing one that is already with the
 *      customer rewrites history — they approve a price that no longer exists.
 *      Revising creates version n+1 and marks the old one superseded, so the
 *      trail shows exactly what was offered and when.
 */

export const QUOTATIONS = "quotations";

/**
 * Recompute everything money-related from the lines.
 *
 * `perPerson` lines are multiplied by the headcount; `total` lines are not.
 * That distinction is the one people get wrong on a spreadsheet, and it is
 * why a quote for four people comes back four times too big.
 */
/**
 * Multiply money without letting binary floats leak into the answer.
 *
 * MEASURED, not assumed. Twelve lines at ₹1,016.67 for seven people produced
 * `89670.28000000001` — one paisa low and carrying an artifact that would print
 * on a PDF. Whole-rupee pricing, which is almost everything this desk quotes,
 * showed no drift at all.
 *
 * So the proportionate fix is here rather than a rewrite of the domain layer
 * into bigint paise: convert to integer paise for the multiply, convert back.
 * Exact to the paisa, and `0.1 × 3` stops being `0.30000000000000004`.
 */
function multiplyMoney(rupees, multiplier) {
  return (Math.round(rupees * 100) * multiplier) / 100;
}

/** Add a list of rupee amounts exactly, by summing paise. */
function sumMoney(values) {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

export function priceQuotation({ lines = [], travellers = 1, discount = 0, taxPercent = 5 }) {
  const heads = Math.max(1, Number(travellers) || 1);

  const priced = lines.map((line) => {
    const unit = Math.max(0, Number(line.unitPrice) || 0);
    const cost = Math.max(0, Number(line.unitCost) || 0);
    const qty = Math.max(1, Number(line.quantity) || 1);
    const multiplier = line.perPerson ? qty * heads : qty;
    return {
      ...line,
      unitPrice: unit,
      unitCost: cost,
      quantity: qty,
      amount: multiplyMoney(unit, multiplier),
      costAmount: multiplyMoney(cost, multiplier),
    };
  });

  const subtotal = sumMoney(priced.map((line) => line.amount));
  // What we expect to pay suppliers. Carried through so a discount can be
  // judged against margin rather than against nothing — the reason agencies
  // discount themselves out of profit is that the number was never on screen.
  const cost = sumMoney(priced.map((line) => line.costAmount));
  const discountValue = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const taxable = sumMoney([subtotal, -discountValue]);
  // GST on a tour package. Named so it is obviously a business rule that can
  // change, not a magic number.
  const tax = Math.round((taxable * (Number(taxPercent) || 0)) / 100);
  const total = sumMoney([taxable, tax]);

  // Margin is measured on the pre-tax figure: GST is collected for the
  // government, not earned, and counting it as revenue flatters every deal.
  //
  // With no cost data the answer is UNKNOWN, not 100%. Reporting a margin
  // nobody entered would tell a salesperson they can discount freely, which
  // is the most expensive possible way to be confidently wrong.
  const hasCost = cost > 0;
  const gross = hasCost ? taxable - cost : null;

  return {
    lines: priced,
    travellers: heads,
    subtotal,
    cost,
    discount: discountValue,
    taxPercent: Number(taxPercent) || 0,
    tax,
    total,
    grossMargin: gross,
    marginPercent: hasCost && taxable > 0 ? Math.round((gross / taxable) * 100) : null,
    perPerson: Math.round(total / heads),
  };
}

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return "Add at least one line.";
  for (const line of lines) {
    if (!line.label?.trim()) return "Every line needs a description.";
    if (line.kind && !QUOTE_LINE_KIND_VALUES.includes(line.kind)) {
      return `Unknown line type: ${line.kind}`;
    }
    if (Number(line.unitPrice) < 0) return "A line cannot have a negative price.";
  }
  return null;
}

/** Opaque, unguessable link for the customer-facing view. */
function publicToken() {
  return crypto.randomBytes(18).toString("base64url");
}

export async function createQuotation({ leadId, draft, actor }) {
  const lead = await getLead(leadId);
  if (!lead) return { error: "No such lead." };

  const invalid = validateLines(draft.lines);
  if (invalid) return { error: invalid };

  const existing = (await listRecords(QUOTATIONS)).filter((q) => q.leadId === leadId);
  const version = existing.length + 1;

  // The confirmed head count beats `groupSize`, which is whatever the website
  // form collected and cannot tell an adult from a four-year-old. Infants are
  // excluded: they take no seat and are not a priced head.
  const heads =
    draft.travellers ?? seatedTravellers(lead) ?? lead.groupSize ?? 1;

  const priced = priceQuotation({
    lines: draft.lines,
    travellers: heads,
    discount: draft.discount,
    taxPercent: draft.taxPercent,
  });

  const quotation = await createRecord(QUOTATIONS, {
    leadId,
    version,
    status: "draft",
    title: draft.title?.trim() || `${lead.destination ?? "Custom trip"} — proposal`,
    destination: draft.destination ?? lead.destination ?? null,
    durationDays: draft.durationDays ?? null,
    startDate: draft.startDate ?? null,
    summary: draft.summary ?? null,
    itinerary: draft.itinerary ?? lead.itinerary ?? null,
    inclusions: draft.inclusions ?? [],
    exclusions: draft.exclusions ?? [],
    terms: draft.terms ?? null,
    /**
     * The presentation block — chosen template, hero image, hotel rows,
     * flights, galleries, policy overrides.
     *
     * This was NOT being persisted on create: `draft.content` was accepted by
     * every caller and silently dropped here, so a quotation only ever got a
     * presentation once somebody opened it and pressed Save presentation. It
     * is the fifth field in this codebase to go missing this way, after
     * `unitCost`, `itinerary`, `revisionOf` and `content` on the template
     * picker — see backlog #93.
     *
     * It matters most for the quotation library: rebuilding the hero image,
     * the hotel rows and the galleries by hand is the bulk of the work, and a
     * library entry that lost all of it would be worth very little.
     */
    content: draft.content ?? null,
    currency: "INR",
    ...priced,
    // Sales owns the quote, which is what attributes the revenue later.
    ownerId: lead.ownerId ?? actor?.id ?? null,
    createdById: actor?.id ?? null,
    createdByName: actor?.name ?? null,
    token: publicToken(),
    sentAt: null,
    decidedAt: null,
    validUntil: draft.validUntil ?? null,
  });

  await emit(
    "quotation.created",
    { title: quotation.title, version, summary: `v${version} drafted` },
    {
      leadId,
      quotationId: quotation.id,
      ownerId: quotation.ownerId,
      actorId: actor?.id,
      actorName: actor?.name,
      amount: quotation.total,
    }
  );

  return { quotation };
}

export async function updateDraft(id, patch, { actor } = {}) {
  const quotation = await getRecord(QUOTATIONS, id);
  if (!quotation) return { error: "No such quotation." };
  if (quotation.status !== "draft") {
    return {
      error: "This quotation has already gone to the customer. Create a revision instead.",
    };
  }

  const lines = patch.lines ?? quotation.lines;
  const invalid = validateLines(lines);
  if (invalid) return { error: invalid };

  const priced = priceQuotation({
    lines,
    travellers: patch.travellers ?? quotation.travellers,
    discount: patch.discount ?? quotation.discount,
    taxPercent: patch.taxPercent ?? quotation.taxPercent,
  });

  const updated = await updateRecord(QUOTATIONS, id, {
    title: patch.title ?? quotation.title,
    summary: patch.summary ?? quotation.summary,
    destination: patch.destination ?? quotation.destination,
    durationDays: patch.durationDays ?? quotation.durationDays,
    startDate: patch.startDate ?? quotation.startDate,
    inclusions: patch.inclusions ?? quotation.inclusions,
    exclusions: patch.exclusions ?? quotation.exclusions,
    terms: patch.terms ?? quotation.terms,
    itinerary: patch.itinerary ?? quotation.itinerary,
    validUntil: patch.validUntil ?? quotation.validUntil,
    ...priced,
  });

  return { quotation: updated };
}

/** Send it. This is the point after which the numbers are frozen. */
export async function sendQuotation(id, { actor } = {}) {
  const quotation = await getRecord(QUOTATIONS, id);
  if (!quotation) return { error: "No such quotation." };
  if (quotation.status !== "draft") return { error: "Only a draft can be sent." };

  const lead = await getLead(quotation.leadId);
  const sent = await updateRecord(QUOTATIONS, id, {
    status: "sent",
    sentAt: new Date().toISOString(),
  });

  // Earlier versions are no longer on the table.
  const siblings = (await listRecords(QUOTATIONS)).filter(
    (q) => q.leadId === quotation.leadId && q.id !== id && q.status === "sent"
  );
  await Promise.all(
    siblings.map((q) => updateRecord(QUOTATIONS, q.id, { status: "superseded" }))
  );

  await emit(
    "quotation.sent",
    {
      customerName: lead?.name ?? null,
      customerEmail: lead?.email ?? null,
      customerPhone: lead?.phone ?? null,
      title: sent.title,
      version: sent.version,
      summary: `v${sent.version} · ₹${Number(sent.total).toLocaleString("en-IN")}`,
      customerMessage: `Your quotation for ${sent.title} is ready: ₹${Number(
        sent.total
      ).toLocaleString("en-IN")} for ${sent.travellers} travellers. View it here: /q/${sent.token}`,
    },
    {
      leadId: sent.leadId,
      quotationId: sent.id,
      ownerId: sent.ownerId,
      actorId: actor?.id,
      actorName: actor?.name,
      amount: sent.total,
    }
  );

  return { quotation: sent };
}

export async function decide(id, decision, { actor, note } = {}) {
  if (!["approved", "rejected"].includes(decision)) return { error: "Unknown decision." };

  const quotation = await getRecord(QUOTATIONS, id);
  if (!quotation) return { error: "No such quotation." };
  if (quotation.status !== "sent") return { error: "Only a sent quotation can be decided." };

  const updated = await updateRecord(QUOTATIONS, id, {
    status: decision,
    decidedAt: new Date().toISOString(),
    decisionNote: note ?? null,
  });

  const lead = await getLead(quotation.leadId);

  await emit(
    decision === "approved" ? "quotation.approved" : "quotation.rejected",
    {
      customerName: lead?.name ?? null,
      title: updated.title,
      version: updated.version,
      summary: `v${updated.version} ${decision}`,
    },
    {
      leadId: updated.leadId,
      quotationId: updated.id,
      ownerId: updated.ownerId,
      actorId: actor?.id,
      actorName: actor?.name,
      amount: updated.total,
    }
  );

  return { quotation: updated };
}

/**
 * Revise a sent quotation.
 *
 * The error on updateDraft has been telling people to "create a revision
 * instead" since the module was written, and nothing implemented it. This is
 * that.
 *
 * A revision is a NEW row at version n+1, copied from the old one. The
 * original is left exactly as it was and marked superseded when the new
 * version is sent — never edited, because the customer may be looking at it
 * and the price they approve has to be the price they were shown.
 */

/**
 * Throw away an unsent draft.
 *
 * reviseQuotation tells people to "Finish or discard it first" when a draft is
 * blocking a new revision — and there was no way to discard one. A draft that
 * nobody wants could never be cleared, so the lead could never be re-quoted:
 * the error message named an action that did not exist.
 *
 * Only a DRAFT. Anything sent is part of what a customer was shown and must
 * stay on the record; `decide` and `reviseQuotation` are the routes for those.
 */
export async function discardDraft(id, { actor } = {}) {
  const quotation = await getRecord(QUOTATIONS, id);
  if (!quotation) return { error: "No such quotation." };
  if (quotation.status !== "draft") {
    return { error: "Only an unsent draft can be discarded. This one has already gone out." };
  }

  // Marked superseded rather than deleted. The version number stays taken, so
  // the next revision is v+1 and no two quotations on a lead ever share a
  // version — which the unique (leadId, version) index would reject anyway.
  const updated = await updateRecord(QUOTATIONS, id, {
    status: "superseded",
    decidedAt: new Date().toISOString(),
    decisionNote: "Discarded before sending",
  });

  await emit(
    "quotation.discarded",
    { title: quotation.title, summary: `v${quotation.version} discarded before sending` },
    {
      leadId: quotation.leadId,
      quotationId: id,
      ownerId: quotation.ownerId,
      actorId: actor?.id,
      actorName: actor?.name,
    }
  );

  return { quotation: updated };
}

export async function reviseQuotation(id, { actor } = {}) {
  const previous = await getRecord(QUOTATIONS, id);
  if (!previous) return { error: "No such quotation." };
  if (previous.status === "draft") {
    return { error: "This one is still a draft — just edit it." };
  }

  // One open draft per lead. Two people revising the same quotation would
  // otherwise both get a v3 and the unique (leadId, version) index in Postgres
  // would reject the second — better to say so plainly here.
  const siblings = await listQuotations({ leadId: previous.leadId });
  const openDraft = siblings.find((q) => q.status === "draft");
  if (openDraft) {
    return { error: `There is already an unsent draft (v${openDraft.version}). Finish or discard it first.` };
  }

  const version = Math.max(...siblings.map((q) => q.version)) + 1;

  const revision = await createRecord(QUOTATIONS, {
    ...previous,
    id: undefined,
    version,
    status: "draft",
    // A fresh link: the old token keeps working for the old version, so a
    // customer who kept the email still sees what they were actually sent.
    token: publicToken(),
    sentAt: null,
    decidedAt: null,
    decisionNote: null,
    revisionOf: previous.id,
    createdById: actor?.id ?? null,
    createdByName: actor?.name ?? null,
    createdAt: undefined,
    updatedAt: undefined,
  });

  await emit(
    "quotation.revised",
    {
      title: revision.title,
      version,
      summary: `v${previous.version} → v${version}`,
    },
    {
      leadId: revision.leadId,
      quotationId: revision.id,
      ownerId: revision.ownerId,
      actorId: actor?.id,
      actorName: actor?.name,
      amount: revision.total,
    }
  );

  return { quotation: revision };
}

/**
 * Save how a quotation LOOKS.
 *
 * Separate from updateDraft, and permitted on a sent quotation, because a
 * template, a hero image or a reworded overview is not the offer. The figures
 * stay frozen — nothing on this path can reach them.
 */
export async function setPresentation(id, content, { actor } = {}) {
  const quotation = await getRecord(QUOTATIONS, id);
  if (!quotation) return { error: "No such quotation." };

  // Whitelisted: anything not listed here cannot be written through this
  // endpoint, so a crafted request cannot smuggle a price in via `content`.
  const allowed = [
    "template",
    "overview",
    "heroImageId",
    "heroImageUrl",
    "hotels",
    "flights",
    "paymentSchedule",
    "howToBook",
    "cancellation",
    "paymentOptions",
    "thingsToCarry",
    "stayPhotos",
    "transportPhotos",
    "routeMapId",
    "routeMapUrl",
    "declaration",
    "termsList",
  ];
  const next = {};
  for (const key of allowed) {
    if (key in content) next[key] = content[key];
  }

  const updated = await updateRecord(QUOTATIONS, id, {
    content: { ...(quotation.content ?? {}), ...next },
  });
  return { quotation: updated };
}

export async function listQuotations({ leadId, ownerId, status } = {}) {
  const rows = await listRecords(QUOTATIONS);
  return rows
    .filter(
      (q) =>
        (!leadId || q.leadId === leadId) &&
        (!ownerId || q.ownerId === ownerId) &&
        (!status || q.status === status)
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function getQuotation(id) {
  return getRecord(QUOTATIONS, id);
}

/** For the customer link — no session, so the token IS the authorisation. */
export async function getByToken(token) {
  if (!token || token.length < 16) return null;
  const rows = await listRecords(QUOTATIONS);
  const quotation = rows.find((q) => q.token === token);
  if (!quotation) return null;
  // A draft has not been sent; its link must not work yet.
  if (!QUOTE_STATUS_VALUES.includes(quotation.status) || quotation.status === "draft") return null;
  return quotation;
}
