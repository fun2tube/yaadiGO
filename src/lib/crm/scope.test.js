import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";

/**
 * Pipeline scope, and the webhook signature.
 *
 * Two security surfaces with no coverage at all until now:
 *
 *   SCOPE — a salesperson must not be able to read a colleague's pipeline by
 *   editing a query string. The comment in workspace.js says this is enforced
 *   in the data layer rather than the UI; nothing proved it.
 *
 *   SIGNATURE — the Razorpay webhook is an unauthenticated public endpoint
 *   that moves a booking's payment state. If the HMAC check can be fooled,
 *   anyone who finds the URL can mark a trip paid.
 */

const db = { leads: [], bookings: [] };

vi.mock("@/lib/cms/records", () => ({
  createRecord: vi.fn(async (c, data) => {
    const row = { id: `${c}_${(db[c] ??= []).length + 1}`, ...data };
    db[c].push(row);
    return row;
  }),
  updateRecord: vi.fn(async (c, id, patch) => {
    const row = (db[c] ?? []).find((r) => r.id === id);
    Object.assign(row, patch);
    return row;
  }),
  listRecords: vi.fn(async (c) => db[c] ?? []),
  getRecord: vi.fn(async (c, id) => (db[c] ?? []).find((r) => r.id === id) ?? null),
}));
vi.mock("@/lib/cms/users", () => ({ listUsers: vi.fn(async () => []) }));
vi.mock("@/lib/crm/events", () => ({ emit: vi.fn(async () => {}), timelineFor: vi.fn(async () => []) }));

const { filterLeads } = await import("@/lib/crm/workspace");
const { verifyWebhook } = await import("@/lib/crm/razorpay");

beforeEach(() => {
  db.leads.length = 0;
  db.bookings.length = 0;
  db.leads.push(
    { id: "l1", name: "Mine", ownerId: "u_priya", status: "new" },
    { id: "l2", name: "Theirs", ownerId: "u_rahul", status: "new" },
    { id: "l3", name: "Nobody's", ownerId: null, status: "new" }
  );
});

describe("pipeline scope", () => {
  it("shows a salesperson their own leads and nobody else's", async () => {
    const { leads: rows } = await filterLeads({ scopeToOwner: "u_priya" });
    const names = rows.map((r) => r.name);
    expect(names).toContain("Mine");
    expect(names).not.toContain("Theirs");
  });

  it("still shows unassigned leads to everyone", async () => {
    // A lead nobody owns is precisely the one that must not be hidden.
    const { leads: rows } = await filterLeads({ scopeToOwner: "u_priya" });
    expect(rows.map((r) => r.name)).toContain("Nobody's");
  });

  it("cannot be widened by also passing someone else's ownerId", async () => {
    // The attack this guards: a scoped user crafting ?ownerId=<colleague>.
    // `scopeToOwner` must win over anything the query string asks for.
    const { leads: rows } = await filterLeads({ scopeToOwner: "u_priya", ownerId: "u_rahul" });
    expect(rows.map((r) => r.name)).not.toContain("Theirs");
  });

  it("shows everything when nobody is scoped", async () => {
    // A manager or admin is not scoped, and must still see the whole board.
    const result = await filterLeads({});
    expect(result.leads).toHaveLength(3);
    // `shown` vs `total` is what the list prints as "3 of 3"; a scoped view
    // must not quietly report the unscoped total.
    expect(result.shown).toBe(3);
    expect(result.total).toBe(3);
  });

  it("reports the scoped count, not the whole-board count", async () => {
    const result = await filterLeads({ scopeToOwner: "u_priya" });
    expect(result.shown).toBe(result.leads.length);
    expect(result.shown).toBeLessThan(result.total);
  });

  it("filters by owner for an unscoped viewer, without leaking the rest", async () => {
    const { leads: rows } = await filterLeads({ ownerId: "u_rahul" });
    expect(rows.map((r) => r.name)).toEqual(["Theirs"]);
  });
});

describe("the Razorpay webhook signature", () => {
  const secret = "whsec_test_abcdef0123456789";
  const body = JSON.stringify({ event: "payment_link.paid", payload: { amount: 1000000 } });

  // The secret is read from the environment inside verifyWebhook, and the
  // function returns { ok, reason } rather than a boolean — the reason goes
  // to the log so a failing webhook can be diagnosed without guessing.
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  });

  // Computed the way Razorpay does it, so this proves interoperability rather
  // than just that the function agrees with itself.
  function sign(payload, key) {
    return createHmac("sha256", key).update(payload).digest("hex");
  }

  it("accepts a correctly signed body", () => {
    expect(verifyWebhook(body, sign(body, secret)).ok).toBe(true);
  });

  it("rejects a tampered body carrying a genuine signature", () => {
    // The real attack: replay a valid signature against a different amount.
    const tampered = JSON.stringify({ event: "payment_link.paid", payload: { amount: 1 } });
    expect(verifyWebhook(tampered, sign(body, secret)).ok).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyWebhook(body, sign(body, "whsec_not_ours")).ok).toBe(false);
  });

  it("rejects a missing signature", () => {
    for (const bad of ["", null, undefined]) {
      expect(verifyWebhook(body, bad).ok).toBe(false);
    }
  });

  it("fails CLOSED when no secret is configured", () => {
    // Failing open would make this public endpoint accept anything the moment
    // the env var went missing.
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const result = verifyWebhook(body, sign(body, secret));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not set/i);
  });

  it("treats a length mismatch as a rejection, not a crash", () => {
    // timingSafeEqual throws when the buffers differ in length, so the length
    // is compared first. Without that this endpoint 500s instead of refusing.
    expect(() => verifyWebhook(body, "abc")).not.toThrow();
    expect(verifyWebhook(body, "abc").ok).toBe(false);
    expect(verifyWebhook(body, "f".repeat(200)).ok).toBe(false);
  });

  it("explains why it refused, for the log", () => {
    expect(verifyWebhook(body, sign(body, "wrong")).reason).toBeTruthy();
  });
});
