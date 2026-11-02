import "server-only";

import { createRecord, getRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { emailKey, phoneKey } from "@/lib/crm/contact-keys";

/**
 * Customers: the person behind every lead (docs/design/ai-cofounder.md §2).
 *
 * A customer is recognised by phone first, then email (lib/crm/contact-keys).
 * Both keys are UNIQUE in Postgres, so the race where two enquiries from the
 * same person land in the same second ends with one customer: the loser's
 * insert is refused and it re-reads the winner's row.
 *
 * Website enquiries only ever FILL BLANKS on an existing customer. A typo in
 * a form must not overwrite a name or email the desk corrected by hand.
 */

export const CUSTOMERS = "customers";

const clean = (value, max = 200) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
};

/**
 * Who this is, if we know them.
 *
 * Phone wins: it is what the desk calls and what WhatsApp threads hang on.
 * An email identifies someone only when it cannot contradict a phone: the
 * enquiry brought no phone, or the customer on file has none. Two different
 * numbers behind one email are two people sharing an inbox (a father and a
 * son on the family address), not one person, the same rule the 0007
 * backfill follows.
 */
export async function findCustomer({ phone, email }) {
  const pk = phoneKey(phone);
  const ek = emailKey(email);
  if (!pk && !ek) return null;
  const rows = await listRecords(CUSTOMERS);
  const byPhone = pk ? rows.find((c) => c.phoneKey === pk) : null;
  if (byPhone) return byPhone;
  const byEmail = ek ? rows.find((c) => c.emailKey === ek) : null;
  if (byEmail && (!pk || !byEmail.phoneKey)) return byEmail;
  return null;
}

async function emailTaken(email) {
  const ek = emailKey(email);
  return Boolean(ek) && (await listRecords(CUSTOMERS)).some((c) => c.emailKey === ek);
}

/**
 * The customer for an incoming enquiry, created if new. Null when the
 * enquiry carries neither a usable phone nor an email: there is nothing to
 * recognise that person by next time.
 */
export async function customerForEnquiry(enquiry) {
  const pk = phoneKey(enquiry.phone);
  const ek = emailKey(enquiry.email);
  if (!pk && !ek) return null;

  const found = await findCustomer(enquiry);
  if (!found) {
    // A shared inbox already on someone else: keep the address to read, but
    // not as this person's key.
    const sharedEmail = await emailTaken(enquiry.email);
    try {
      return await createRecord(CUSTOMERS, {
        name: clean(enquiry.name, 120) ?? "Website visitor",
        phone: pk ? clean(enquiry.phone, 40) : null,
        phoneKey: pk,
        email: ek ? clean(enquiry.email, 160) : null,
        emailKey: sharedEmail ? null : ek,
        company: clean(enquiry.company, 160),
        city: clean(enquiry.city, 80),
        firstSource: clean(enquiry.source, 40) ?? "unknown",
        firstSeenAt: new Date().toISOString(),
        tags: [],
        notes: null,
        marketingConsent: false,
        consentAt: null,
      });
    } catch (error) {
      // A unique key refused us: someone else created this person a moment
      // ago. Theirs is the customer.
      const winner = await findCustomer(enquiry);
      if (winner) return winner;
      throw error;
    }
  }

  const patch = {};
  if (!found.phoneKey && pk && !(await findCustomer({ phone: enquiry.phone }))) {
    patch.phone = clean(enquiry.phone, 40);
    patch.phoneKey = pk;
  }
  // Only adopt an email nobody else is known by: it may be a shared family
  // inbox already on another customer.
  if (!found.emailKey && ek && !(await emailTaken(enquiry.email))) {
    patch.email = clean(enquiry.email, 160);
    patch.emailKey = ek;
  }
  if (!found.company && clean(enquiry.company)) patch.company = clean(enquiry.company, 160);
  if (!Object.keys(patch).length) return found;
  return (await updateRecord(CUSTOMERS, found.id, patch)) ?? found;
}

/** Edits from the desk. Keys are recomputed; a clash is reported, not merged. */
export async function updateCustomer(id, input) {
  const current = await getRecord(CUSTOMERS, id);
  if (!current) return { error: "That customer no longer exists." };

  const next = {
    name: clean(input.name, 120) ?? current.name,
    phone: input.phone === undefined ? current.phone : clean(input.phone, 40),
    email: input.email === undefined ? current.email : clean(input.email, 160),
    company: input.company === undefined ? current.company : clean(input.company, 160),
    city: input.city === undefined ? current.city : clean(input.city, 80),
    notes: input.notes === undefined ? current.notes : clean(input.notes, 4000),
    tags: input.tags === undefined ? current.tags : [...new Set(input.tags.map((t) => clean(t, 40)).filter(Boolean))].slice(0, 20),
  };
  next.phoneKey = phoneKey(next.phone);
  next.emailKey = emailKey(next.email);
  if (next.phone && !next.phoneKey) return { error: "That phone number needs at least 10 digits." };
  if (next.email && !next.emailKey) return { error: "That email address doesn't look right." };
  if (!next.phoneKey && !next.emailKey) return { error: "Keep a phone number or an email, or we can't recognise them next time." };

  const rows = await listRecords(CUSTOMERS);
  const clash = rows.find(
    (c) => c.id !== id && ((next.phoneKey && c.phoneKey === next.phoneKey) || (next.emailKey && c.emailKey === next.emailKey))
  );
  if (clash) return { error: `${clash.name} already has that ${clash.phoneKey === next.phoneKey ? "phone number" : "email"}.`, clashId: clash.id };

  if (input.marketingConsent !== undefined && input.marketingConsent !== current.marketingConsent) {
    next.marketingConsent = Boolean(input.marketingConsent);
    next.consentAt = next.marketingConsent ? new Date().toISOString() : null;
  }
  return { customer: await updateRecord(CUSTOMERS, id, next) };
}

const LIVE = (b) => b.status !== "cancelled";
const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);

/**
 * Every customer with what they are worth to the business. Pure joins over
 * the record store, so it reads the same on Postgres and the file store.
 *
 * `ownerId` scopes to customers with at least one lead that person owns:
 * a salesperson sees their own customers, as with leads.
 *
 * @param {{ search?: string, ownerId?: string | null }} [options]
 */
export async function listCustomersWithStats({ search = "", ownerId = null } = {}) {
  const [customers, leads, bookings, payments] = await Promise.all([
    listRecords(CUSTOMERS),
    listRecords("leads"),
    listRecords("bookings"),
    listRecords("payments"),
  ]);

  const leadsBy = groupBy(leads.filter((l) => l.customerId), (l) => l.customerId);
  const bookingsByLead = groupBy(bookings.filter((b) => b.leadId), (b) => b.leadId);
  const paidByBooking = groupBy(payments, (p) => p.bookingId);

  const query = search.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");

  return customers
    .map((customer) => {
      const theirLeads = leadsBy.get(customer.id) ?? [];
      const theirBookings = theirLeads.flatMap((l) => bookingsByLead.get(l.id) ?? []).filter(LIVE);
      const lastLead = theirLeads.map((l) => l.receivedAt ?? l.createdAt).sort().at(-1) ?? null;
      return {
        ...customer,
        enquiries: theirLeads.length,
        bookings: theirBookings.length,
        bookedValue: sum(theirBookings, (b) => b.total),
        collected: sum(theirBookings.flatMap((b) => paidByBooking.get(b.id) ?? []), (p) => p.amount),
        lastActivity: lastLead ?? customer.firstSeenAt,
        repeat: theirBookings.length > 1,
        ownerIds: [...new Set(theirLeads.map((l) => l.ownerId).filter(Boolean))],
      };
    })
    .filter((c) => !ownerId || c.ownerIds.includes(ownerId))
    .filter((c) => {
      if (!query) return true;
      if (digits.length >= 4 && String(c.phoneKey ?? "").includes(digits)) return true;
      return [c.name, c.email, c.company, c.city].some((v) => String(v ?? "").toLowerCase().includes(query));
    })
    .sort((a, b) => String(b.lastActivity).localeCompare(String(a.lastActivity)));
}

/** One customer with every enquiry, quotation, booking and payment. */
export async function getCustomerDossier(id) {
  const customer = await getRecord(CUSTOMERS, id);
  if (!customer) return null;
  const [leads, quotations, bookings, payments] = await Promise.all([
    listRecords("leads"),
    listRecords("quotations"),
    listRecords("bookings"),
    listRecords("payments"),
  ]);
  const theirLeads = leads
    .filter((l) => l.customerId === id)
    .sort((a, b) => String(b.receivedAt ?? b.createdAt).localeCompare(String(a.receivedAt ?? a.createdAt)));
  const leadIds = new Set(theirLeads.map((l) => l.id));
  const theirQuotes = quotations.filter((q) => leadIds.has(q.leadId));
  const theirBookings = bookings.filter((b) => leadIds.has(b.leadId));
  const bookingIds = new Set(theirBookings.map((b) => b.id));
  const theirPayments = payments.filter((p) => bookingIds.has(p.bookingId));
  const live = theirBookings.filter(LIVE);

  return {
    customer,
    leads: theirLeads,
    quotations: theirQuotes,
    bookings: theirBookings,
    payments: theirPayments,
    totals: {
      enquiries: theirLeads.length,
      bookings: live.length,
      bookedValue: sum(live, (b) => b.total),
      collected: sum(theirPayments, (p) => p.amount),
      outstanding: sum(live, (b) => b.total) - sum(theirPayments, (p) => p.amount),
    },
    ownerIds: [...new Set(theirLeads.map((l) => l.ownerId).filter(Boolean))],
  };
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}
