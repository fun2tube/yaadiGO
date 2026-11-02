import { describe, it, expect } from "vitest";
import { hasContent } from "./slot-text";

describe("itinerary slot text", () => {
  it("drops placeholders the models write for an empty slot", () => {
    for (const text of ["Not applicable", "not applicable.", "N/A", "NA", "None", "-", "—", "", "   ", null, undefined]) {
      expect(hasContent(text)).toBe(false);
    }
  });

  it("keeps anything that actually describes the day", () => {
    expect(hasContent("Early transfer to the airport.")).toBe(true);
    expect(hasContent("Free afternoon at the lake")).toBe(true);
    // "Free" on its own is free time — that IS the plan for the slot.
    expect(hasContent("Free")).toBe(true);
    expect(hasContent("Not much driving today — rest in Kaza.")).toBe(true);
  });
});
