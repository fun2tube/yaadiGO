import { describe, expect, it } from "vitest";
import { mergeDepartureEdits } from "./departure-edits";

const batch = (over = {}) => ({
  id: "kve-1012",
  start: "2026-10-12",
  end: "2026-10-18",
  price: 28500,
  capacity: 12,
  ...over,
});
const state = (over = {}) => ({ id: "kve-1012", booked: 0, held: 0, ...over });

describe("mergeDepartureEdits — the editor sets a batch's size, never its seats left", () => {
  it("cannot undo a booking, because there is no seat count to write (#130)", () => {
    // 4 booked meanwhile; the editor only changes the price.
    const { departures } = mergeDepartureEdits([batch()], [batch({ price: 29900 })], [state({ booked: 4 })]);
    expect(departures[0]).toEqual(expect.objectContaining({ capacity: 12, price: 29900 }));
    expect(departures[0]).not.toHaveProperty("seatsLeft");
  });

  it("lets a batch grow, or shrink down to what is already committed", () => {
    expect(mergeDepartureEdits([batch()], [batch({ capacity: 16 })], [state({ booked: 4 })]).departures[0].capacity).toBe(16);
    expect(mergeDepartureEdits([batch()], [batch({ capacity: 6 })], [state({ booked: 4, held: 2 })]).departures[0].capacity).toBe(6);
  });

  it("refuses to shrink below the travellers booked or held", () => {
    const result = mergeDepartureEdits([batch()], [batch({ capacity: 5 })], [state({ booked: 4, held: 2 })]);
    expect(result.error).toMatch(/6 seats are already booked or held/);
  });

  it("refuses to remove a batch with anyone on it", () => {
    const result = mergeDepartureEdits([batch()], [], [state({ held: 3 })]);
    expect(result.error).toMatch(/3 travellers are booked or held on the 2026-10-12 batch/);
  });

  it("allows removing an empty batch, and adding a new one", () => {
    const fresh = { id: "new", start: "2027-03-01", end: "2027-03-07", price: 30000, capacity: 14 };
    const result = mergeDepartureEdits([batch()], [fresh], [state()]);
    expect(result.departures.map((d) => d.id)).toEqual(["new"]);
  });

  it("never reopens a batch the desk closed or cancelled", () => {
    const { departures } = mergeDepartureEdits([batch({ closed: true, cancelled: true })], [batch()], [state()]);
    expect(departures[0]).toMatchObject({ closed: true, cancelled: true });
  });

  it("keeps minimum-to-run and cut-off unless the editor changes them", () => {
    const live = [batch({ minToRun: 6, cutoffDays: 10 })];
    expect(mergeDepartureEdits(live, [batch()], [state()]).departures[0]).toMatchObject({ minToRun: 6, cutoffDays: 10 });
    expect(mergeDepartureEdits(live, [batch({ minToRun: 8, cutoffDays: 5 })], [state()]).departures[0]).toMatchObject({ minToRun: 8, cutoffDays: 5 });
  });

  it("refuses two batches on the same start date, and a batch that ends before it starts", () => {
    const twin = batch({ id: "other" });
    expect(mergeDepartureEdits([batch()], [batch(), twin], [state()]).error).toMatch(/Two batches start on 2026-10-12/);
    expect(mergeDepartureEdits([batch()], [batch({ end: "2026-10-10" })], [state()]).error).toMatch(/ends before it starts/);
  });
});
