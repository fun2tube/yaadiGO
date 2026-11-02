import { describe, expect, it } from "vitest";
import {
  CUTOFF_DAYS_DEFAULT,
  capacityOf,
  commitments,
  departureState,
  holdIsActive,
  normaliseCapacity,
  refusal,
} from "./inventory";

const holding = (status) => ["confirmed", "part-paid", "paid"].includes(status);
const NOW = new Date("2026-10-10T09:00:00Z").getTime();
const batch = (over = {}) => ({ id: "b1", start: "2026-11-20", end: "2026-11-26", price: 30000, capacity: 12, ...over });

function state(departure, { bookings = [], holds = [], now = NOW } = {}) {
  const { booked, held } = commitments({ bookings, holds, holdsSeats: holding, now });
  return departureState(departure, { tripSlug: "t", booked, held, now });
}

const booking = (travellers, status = "confirmed", departureId = "b1") => ({ tripSlug: "t", departureId, travellers, status });
const hold = (seats, hoursLeft = 10, status = "active") => ({
  tripSlug: "t",
  departureId: "b1",
  seats,
  status,
  expiresAt: new Date(NOW + hoursLeft * 3_600_000).toISOString(),
});

describe("seats are derived from bookings and holds", () => {
  it("capacity minus confirmed travellers minus active holds", () => {
    const s = state(batch(), { bookings: [booking(3), booking(2, "paid")], holds: [hold(2)] });
    expect(s).toMatchObject({ capacity: 12, booked: 5, held: 2, seatsLeft: 5, status: "available" });
  });

  it("ignores requests that are not yet confirmed, and cancelled bookings", () => {
    const s = state(batch(), { bookings: [booking(4, "requested"), booking(4, "cancelled")] });
    expect(s.seatsLeft).toBe(12);
  });

  it("an expired hold gives its seats back without any job running", () => {
    const s = state(batch(), { holds: [hold(5, -1)] });
    expect(s.seatsLeft).toBe(12);
    expect(holdIsActive(hold(5, -1), NOW)).toBe(false);
  });

  it("only counts bookings on this batch", () => {
    const s = state(batch(), { bookings: [booking(6, "confirmed", "other")] });
    expect(s.seatsLeft).toBe(12);
  });
});

describe("status", () => {
  it("filling at three seats or fewer, sold out at none", () => {
    expect(state(batch(), { bookings: [booking(9)] }).status).toBe("filling");
    expect(state(batch(), { bookings: [booking(12)] }).status).toBe("soldout");
  });

  it(`closes ${CUTOFF_DAYS_DEFAULT} days before departure by default`, () => {
    const soon = batch({ start: "2026-10-15", end: "2026-10-20" }); // 5 days out
    expect(state(soon).status).toBe("closed");
    expect(state(soon).bookable).toBe(false);
    expect(state(soon).cutoffDate).toBe("2026-10-08");
  });

  it("honours a batch's own cut-off", () => {
    const soon = batch({ start: "2026-10-15", end: "2026-10-20", cutoffDays: 2 });
    expect(state(soon).status).toBe("available");
  });

  it("can be closed or cancelled by hand, and completes after it ends", () => {
    expect(state(batch({ closed: true })).status).toBe("closed");
    expect(state(batch({ cancelled: true })).status).toBe("cancelled");
    expect(state(batch({ start: "2026-09-01", end: "2026-09-07" })).status).toBe("completed");
  });

  it("is guaranteed once the minimum books, and at risk when it is close and short", () => {
    expect(state(batch({ minToRun: 6 }), { bookings: [booking(6)] }).guaranteed).toBe(true);
    const close = batch({ start: "2026-10-25", end: "2026-10-30", minToRun: 6 });
    expect(state(close, { bookings: [booking(2)] }).atRisk).toBe(true);
    expect(state(batch({ minToRun: 6 }), { bookings: [booking(2)] }).atRisk).toBe(false); // 41 days out
  });
});

describe("batches that predate capacity", () => {
  it("infer their size as seats left plus seats booked", () => {
    expect(capacityOf({ seatsLeft: 4 }, 6)).toBe(10);
    const [d] = normaliseCapacity([{ id: "b1", seatsLeft: 4 }], "t", new Map([["t:b1", 6]]));
    expect(d).toEqual({ id: "b1", capacity: 10 });
  });

  it("then derive the same seats left they used to show", () => {
    const legacy = { id: "b1", start: "2026-11-20", end: "2026-11-26", seatsLeft: 4 };
    expect(state(legacy, { bookings: [booking(6)] }).seatsLeft).toBe(4);
  });
});

describe("refusal — what the desk reads aloud", () => {
  it("allows exactly the seats that are left, and no more", () => {
    const s = state(batch(), { bookings: [booking(10)] });
    expect(refusal(s, 2)).toBeNull();
    expect(refusal(s, 3)).toBe("Only 2 seats left on the 2026-11-20 batch.");
  });

  it("refuses closed and cancelled batches whatever the seats", () => {
    expect(refusal(state(batch({ closed: true })), 1)).toMatch(/closed/);
    expect(refusal(state(batch({ cancelled: true })), 1)).toMatch(/cancelled/);
  });
});
