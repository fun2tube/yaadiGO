import "server-only";

import { createRecord, getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { getQuotation, createQuotation } from "@/lib/crm/quotations";
import { emit } from "@/lib/crm/events";

/**
 * The quotation library.
 *
 * A travel desk quotes the same trips over and over. Spiti in June is the
 * same eight nights, the same road, the same four hotels, whoever is asking —
 * and today every one of those is rebuilt from scratch, which is both slow and
 * the reason two customers get two different itineraries for one product.
 *
 * So: a salesperson saves a quotation they are happy with, and the next
 * matching enquiry starts from it instead of from an empty form.
 *
 * Split in two because they are genuinely different products:
 *
 *   FIXED DEPARTURE — set dates, a shared group, a price held per batch. The
 *   itinerary is the product and barely changes between customers.
 *
 *   CUSTOMISED — a starting point someone reshapes. The shape is reusable;
 *   the price is a beginning, not an answer.
 *
 * Conflating them would put "4 seats left" on something with no seats, which
 * is the same reason `tours.js` and `packages.js` are separate files.
 */

export const QUOTE_TEMPLATES = "quotationTemplates";

export const TEMPLATE_KINDS = [
  {
    value: "fixed-departure",
    label: "Fixed departure",
    blurb: "Set dates, shared group, price held per batch. Reused almost verbatim.",
  },
  {
    value: "customised",
    label: "Customised",
    blurb: "A shape to reshape. Dates, hotels and pace change per customer.",
  },
];

export const TEMPLATE_KIND_VALUES = TEMPLATE_KINDS.map((k) => k.value);

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Save a quotation as a reusable one.
 *
 * Everything that describes the TRIP is kept. Everything that identifies the
 * CUSTOMER is deliberately dropped — a library entry that quietly carries
 * Mr Sharma's name and travel dates into somebody else's quotation is the
 * worst possible bug here, and the kind nobody notices until it has been sent.
 */
export async function saveAsTemplate(quotationId, { name, kind, tags = [], actor } = {}) {
  const quotation = await getQuotation(quotationId);
  if (!quotation) return { error: "No such quotation." };
  if (!TEMPLATE_KIND_VALUES.includes(kind)) return { error: "Choose fixed departure or customised." };

  const title = name?.trim() || quotation.title;
  if (!title) return { error: "Give it a name you will recognise in six months." };

  const existing = await listRecords(QUOTE_TEMPLATES);
  const base = slugify(title);
  // A duplicate name is a mistake, not a merge: the second one would silently
  // overwrite the first and nobody would know which they were using.
  const slug = existing.some((t) => t.slug === base) ? `${base}-${Date.now().toString(36)}` : base;

  const template = await createRecord(QUOTE_TEMPLATES, {
    slug,
    name: title,
    kind,
    tags: tags.filter(Boolean).slice(0, 12),

    // The trip.
    destination: quotation.destination ?? null,
    durationDays: quotation.durationDays ?? null,
    summary: quotation.summary ?? null,
    lines: quotation.lines ?? [],
    inclusions: quotation.inclusions ?? [],
    exclusions: quotation.exclusions ?? [],
    terms: quotation.terms ?? null,
    taxPercent: quotation.taxPercent ?? 5,
    itinerary: quotation.itinerary ?? null,
    // Presentation travels too — the chosen template, hero image, hotel rows
    // and galleries. Rebuilding those by hand is most of the work.
    content: quotation.content ?? null,
    // The head count the prices were built for, so applying it elsewhere can
    // say what changed rather than silently re-multiplying.
    referenceTravellers: quotation.travellers ?? 1,

    // NOT copied: name, phone, email, leadId, startDate, token, status,
    // version, decidedAt, sentAt. None of it belongs to the next customer.

    sourceQuotationId: quotation.id,
    createdById: actor?.id ?? null,
    createdByName: actor?.name ?? null,
    createdAt: new Date().toISOString(),
    usedCount: 0,
    lastUsedAt: null,
  });

  await emit(
    "quotation.templated",
    { summary: `Saved "${title}" to the library` },
    { quotationId: quotation.id, actorId: actor?.id ?? null, actorName: actor?.name ?? null }
  );

  return { template };
}

export async function listTemplates({ kind, search } = {}) {
  const rows = (await listRecords(QUOTE_TEMPLATES)) ?? [];
  const needle = search?.trim().toLowerCase();

  return rows
    // Archived entries stay in the store so an old quotation can still be
    // traced back to its source, but they must never appear in the picker.
    .filter((t) => !t.archivedAt)
    .filter((t) => (kind ? t.kind === kind : true))
    .filter((t) => {
      if (!needle) return true;
      return [t.name, t.destination, ...(t.tags ?? [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    })
    // Most-used first: the thing you reached for last month is the thing you
    // are most likely to want now.
    .sort((a, b) => (b.usedCount ?? 0) - (a.usedCount ?? 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function getTemplate(id) {
  return getRecord(QUOTE_TEMPLATES, id);
}

/**
 * Suggest library entries that match an enquiry.
 *
 * Scored rather than filtered: a salesperson wants "closest first", not an
 * empty list because nothing matched exactly. Destination carries the most
 * weight because it is the one thing that is never negotiable.
 */
export async function suggestFor(lead, { limit = 5 } = {}) {
  const all = await listTemplates();
  if (!lead) return all.slice(0, limit);

  const destination = String(lead.destination ?? "").toLowerCase();
  const nights = Number(lead.durationDays) || null;

  return all
    .map((template) => {
      let score = 0;
      const dest = String(template.destination ?? "").toLowerCase();

      if (destination && dest) {
        if (dest === destination) score += 100;
        else if (dest.includes(destination) || destination.includes(dest)) score += 60;
      }
      // A 9-day template for an 8-day ask is a good start; a 3-day one is not.
      if (nights && template.durationDays) {
        const gap = Math.abs(template.durationDays - nights);
        if (gap === 0) score += 30;
        else if (gap <= 2) score += 15;
      }
      // Popularity breaks ties, it does not create matches.
      score += Math.min(10, template.usedCount ?? 0);
      return { template, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.template);
}

/**
 * Start a new quotation for a lead from a library entry.
 *
 * The prices are UNIT prices and the per-person flag travels with each line,
 * so `createQuotation` re-prices the whole thing for whoever is actually
 * travelling now. That is the part that would otherwise go wrong silently: a
 * template built for two people, applied to a family of five, must not quote
 * the two-person total.
 */
export async function applyTemplate(templateId, { leadId, actor } = {}) {
  const template = await getRecord(QUOTE_TEMPLATES, templateId);
  if (!template) return { error: "No such saved quotation." };
  if (!leadId) return { error: "A quotation is always built against an enquiry." };

  const result = await createQuotation({
    leadId,
    actor,
    draft: {
      title: template.name,
      summary: template.summary ?? "",
      destination: template.destination ?? null,
      durationDays: template.durationDays ?? null,
      lines: template.lines ?? [],
      inclusions: template.inclusions ?? [],
      exclusions: template.exclusions ?? [],
      terms: template.terms ?? null,
      taxPercent: template.taxPercent ?? 5,
      discount: 0,
      itinerary: template.itinerary ?? null,
      content: template.content ?? null,
    },
  });

  if (result.error) return result;

  // Usage is what orders the library, so it has to be recorded even though
  // nothing else reads it.
  await updateRecord(QUOTE_TEMPLATES, templateId, {
    usedCount: (template.usedCount ?? 0) + 1,
    lastUsedAt: new Date().toISOString(),
  });

  return { quotation: result.quotation, template };
}

export async function deleteTemplate(id, { actor } = {}) {
  const template = await getRecord(QUOTE_TEMPLATES, id);
  if (!template) return { error: "No such saved quotation." };

  // Archived, never deleted. A quotation built from it six months ago is a
  // document somebody may have to explain, and "where did this come from" is
  // unanswerable once the source is gone.
  await updateRecord(QUOTE_TEMPLATES, id, {
    archivedAt: new Date().toISOString(),
    archivedById: actor?.id ?? null,
  });

  return { ok: true };
}
