import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The retry worker.
 *
 * Worth testing properly because every bug in a retry loop is either "never
 * retries" (silent data loss) or "retries forever" (a provider ban), and both
 * only show up in production.
 */

const store = { outbox: [] };
const delivered = [];
let deliverBehaviour = () => {};

vi.mock("@/lib/cms/records", () => ({
  listRecords: vi.fn(async () => store.outbox),
  updateRecord: vi.fn(async (_c, id, patch) => {
    const row = store.outbox.find((r) => r.id === id);
    Object.assign(row, patch);
    return row;
  }),
  createRecord: vi.fn(),
  getRecord: vi.fn(async (_c, id) => store.outbox.find((r) => r.id === id) ?? null),
}));

let providersConfigured = true;

vi.mock("@/lib/crm/notifications", () => ({
  OUTBOX: "outbox",
  channelStatus: vi.fn(() => ({
    email: { configured: providersConfigured },
    whatsapp: { configured: providersConfigured },
  })),
  deliverQueued: vi.fn(async (row) => {
    delivered.push(row.id);
    return deliverBehaviour(row);
  }),
}));

const { runOutbox, isDue, nextAttemptAt } = await import("@/lib/crm/outbox-worker");

const MIN = 60000;
const T0 = Date.UTC(2026, 9, 3, 12, 0, 0);

// An explicit counter, not `store.outbox.length`: two row() calls inside one
// push() are both evaluated before either is appended, so the length-based
// version handed both rows the same id — and a test fixture with duplicate ids
// fails in ways that look like worker bugs.
let seq = 0;

function row(over = {}) {
  seq += 1;
  return {
    id: `o${seq}`,
    channel: "email",
    to: "a@b.test",
    body: "hello",
    status: "failed",
    attempts: 1,
    lastAttemptAt: new Date(T0).toISOString(),
    createdAt: new Date(T0).toISOString(),
    ...over,
  };
}

beforeEach(() => {
  providersConfigured = true;
  seq = 0;
  store.outbox.length = 0;
  delivered.length = 0;
  deliverBehaviour = () => {};
});

describe("isDue", () => {
  it("never retries something already sent", () => {
    expect(isDue(row({ status: "sent" }), T0 + 999 * MIN)).toBe(false);
  });

  it("always retries a pending message", () => {
    // `pending` means no provider was configured — not a failure. The moment
    // SMTP_URL exists, the backlog should go out rather than wait on a backoff.
    expect(isDue(row({ status: "pending", attempts: 0 }), T0)).toBe(true);
  });

  it("waits for the backoff before retrying a failure", () => {
    const r = row({ attempts: 2 }); // next gap is 5 minutes
    expect(isDue(r, T0 + 1 * MIN)).toBe(false);
    expect(isDue(r, T0 + 5 * MIN)).toBe(true);
  });

  it("widens the gap with each attempt", () => {
    const gaps = [1, 2, 3, 4].map(
      (attempts) => nextAttemptAt(row({ attempts })) - T0
    );
    // Strictly increasing — the whole point of a backoff.
    for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
  });

  it("gives up rather than retrying forever", () => {
    expect(isDue(row({ attempts: 6 }), T0 + 9999 * MIN)).toBe(false);
  });
});

describe("runOutbox", () => {
  it("sends a due message and marks it sent", async () => {
    store.outbox.push(row({ attempts: 2 }));
    const result = await runOutbox({ now: T0 + 10 * MIN });

    expect(result).toMatchObject({ due: 1, sent: 1, failed: 0 });
    expect(store.outbox[0].status).toBe("sent");
    expect(store.outbox[0].reason).toBeNull();
  });

  it("delivers the backlog once a provider appears", async () => {
    store.outbox.push(row({ status: "pending", attempts: 0, reason: "No email provider configured" }));
    const result = await runOutbox({ now: T0 });
    expect(result.sent).toBe(1);
    expect(store.outbox[0].status).toBe("sent");
  });

  it("counts the attempt even when delivery throws", async () => {
    // The counter must advance before the send, or a message that throws in an
    // uncaught way retries every single run at attempt zero, forever.
    deliverBehaviour = () => {
      throw new Error("Resend responded 500");
    };
    store.outbox.push(row({ attempts: 1 }));
    await runOutbox({ now: T0 + 10 * MIN });

    expect(store.outbox[0].attempts).toBe(2);
    expect(store.outbox[0].status).toBe("failed");
    expect(store.outbox[0].reason).toContain("500");
  });

  it("abandons a message after the last attempt, with a distinct status", async () => {
    deliverBehaviour = () => {
      throw new Error("mailbox does not exist");
    };
    store.outbox.push(row({ attempts: 5 }));
    const result = await runOutbox({ now: T0 + 9999 * MIN });

    expect(result.gaveUp).toBe(1);
    // "abandoned", not "failed" — the outbox screen must distinguish "still
    // trying" from "nobody will ever receive this".
    expect(store.outbox[0].status).toBe("abandoned");
    expect(store.outbox[0].reason).toContain("Gave up after 6");
  });

  it("leaves a message alone until its backoff has elapsed", async () => {
    store.outbox.push(row({ attempts: 3 })); // 20-minute gap
    const result = await runOutbox({ now: T0 + 2 * MIN });
    expect(result).toMatchObject({ due: 0, sent: 0 });
    expect(delivered).toHaveLength(0);
  });

  it("attempts each row at most once per run", async () => {
    store.outbox.push(row({ attempts: 2 }), row({ attempts: 2 }));
    await runOutbox({ now: T0 + 10 * MIN });
    expect(delivered).toHaveLength(2);
    expect(new Set(delivered).size).toBe(2);
  });

  it("caps how much one run will attempt", async () => {
    for (let i = 0; i < 12; i += 1) store.outbox.push(row({ attempts: 2 }));
    const result = await runOutbox({ now: T0 + 10 * MIN, limit: 5 });
    expect(result.due).toBe(5);
    expect(delivered).toHaveLength(5);
  });

  it("one bad message does not stop the rest", async () => {
    deliverBehaviour = (r) => {
      if (r.id === "o1") throw new Error("nope");
    };
    store.outbox.push(row({ attempts: 2 }), row({ attempts: 2 }));
    const result = await runOutbox({ now: T0 + 10 * MIN });

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
  });
});

describe("runOutbox — waiting on configuration", () => {
  it("does NOT spend an attempt when no provider exists", async () => {
    // Found by running this for real: 17 pending messages each burned an
    // attempt on the first run, so the backlog would have been abandoned
    // before anybody configured email — the exact thing the `pending` state
    // exists to survive.
    providersConfigured = false;
    store.outbox.push(row({ status: "pending", attempts: 0 }));

    const result = await runOutbox({ now: T0 });

    expect(result).toMatchObject({ due: 0, sent: 0, failed: 0, waitingForProvider: 1 });
    expect(store.outbox[0].attempts).toBe(0);
    expect(store.outbox[0].status).toBe("pending");
    expect(delivered).toHaveLength(0);
  });

  it("delivers the whole backlog the moment a provider appears", async () => {
    providersConfigured = false;
    store.outbox.push(row({ status: "pending", attempts: 0 }), row({ status: "pending", attempts: 0 }));
    await runOutbox({ now: T0 });
    expect(delivered).toHaveLength(0);

    providersConfigured = true;
    const result = await runOutbox({ now: T0 + MIN });
    expect(result.sent).toBe(2);
  });
});
