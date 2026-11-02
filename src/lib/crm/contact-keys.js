/**
 * How a person is recognised, in one place: lead dedupe (lib/crm/leads.js),
 * customers (lib/crm/customers.js) and the customers backfill in
 * drizzle/0007_customers.sql all use exactly these rules. If two of them
 * disagreed, the same caller would be one customer in one screen and two in
 * another.
 */

/** Digits only, last 10 — so +91 98765 43210 and 09876543210 are one person. */
export function phoneKey(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Lower-cased and trimmed; null unless it looks like an address. */
export function emailKey(email) {
  const value = String(email ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : null;
}
