import { describe, it, expect } from "vitest";
import { decodeTrip, encodeTrip, parseAsk } from "@/lib/trip-link";

describe("parseAsk — the length typed into the home search", () => {
  it.each([
    ["Manali 4 days", "Manali", 4],
    ["4 days in Manali", "Manali", 4],
    ["Kashmir 5N/6D", "Kashmir", 6],
    ["Goa 3 nights", "Goa", 4],
    ["Bali for a week", "Bali", 7],
    ["Vietnam 10d", "Vietnam", 10],
    ["Rishikesh weekend", "Rishikesh", 2],
  ])("%s → %s, %i days", (text, destination, days) => {
    expect(parseAsk(text)).toEqual({ destination, durationDays: days });
  });

  it("leaves a plain destination alone", () => {
    expect(parseAsk("somewhere with mountains")).toEqual({
      destination: "somewhere with mountains",
      durationDays: null,
    });
  });

  it("caps an absurd length at the planner's 21-day maximum", () => {
    expect(parseAsk("Europe 45 days").durationDays).toBe(21);
  });

  it("round-trips through the link", () => {
    const encoded = encodeTrip({ destination: "Manali", durationDays: 4 });
    expect(decodeTrip(encoded)).toMatchObject({ destination: "Manali", durationDays: 4 });
  });
});
