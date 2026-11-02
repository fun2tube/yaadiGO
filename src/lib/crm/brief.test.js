import { describe, it, expect } from "vitest";
import {
  normaliseBrief,
  emptyBrief,
  roomCapacity,
  childBand,
  seatedTravellers,
  totalTravellers,
  briefGaps,
  briefSummary,
  travellerSummary,
  mealPlanLabel,
  HOTEL_CATEGORY_VALUES,
  MEAL_PLAN_VALUES,
} from "@/lib/crm/brief";

/**
 * The trip brief vocabulary.
 *
 * Worth testing properly despite being "just enums": every one of these
 * values ends up in a dropdown, in a quotation the customer reads, and in a
 * price. A room that silently loses its occupancy prices the wrong number of
 * beds, and this project has already shipped four silent field drops.
 */

describe("normaliseBrief", () => {
  it("gives every pre-existing lead a usable brief", () => {
    // Every lead captured before this field existed has brief: null, and all
    // of them still have to open.
    for (const input of [null, undefined, "", 0, [], "not an object"]) {
      const brief = normaliseBrief(input);
      expect(brief.rooms).toHaveLength(1);
      expect(brief.stays).toEqual([]);
      expect(brief.hotelCategory).toBeNull();
    }
  });

  it("drops enum values it does not recognise instead of rendering them", () => {
    const brief = normaliseBrief({
      hotelCategory: "7-star",
      mealPlan: "BRUNCH",
      transportModes: ["car", "teleport", "train"],
    });
    expect(brief.hotelCategory).toBeNull();
    expect(brief.mealPlan).toBeNull();
    // An unknown mode is dropped; the valid ones around it survive.
    expect(brief.transportModes).toEqual(["car", "train"]);
  });

  it("keeps valid values untouched", () => {
    const brief = normaliseBrief({
      hotelCategory: "4-star",
      mealPlan: "MAP",
      transportModes: ["flight", "car"],
      specialRequests: "Jain food",
    });
    expect(brief.hotelCategory).toBe("4-star");
    expect(brief.mealPlan).toBe("MAP");
    expect(brief.transportModes).toEqual(["flight", "car"]);
    expect(brief.specialRequests).toBe("Jain food");
  });

  it("repairs a half-formed room rather than dropping it", () => {
    const brief = normaliseBrief({ rooms: [{ roomClass: "penthouse", count: 0, extraMattress: -3 }] });
    expect(brief.rooms[0]).toEqual({
      roomClass: "standard",
      occupancy: "double",
      extraMattress: 0,
      count: 1,
    });
  });

  it("never returns zero rooms", () => {
    expect(normaliseBrief({ rooms: [] }).rooms).toHaveLength(1);
  });

  it("round-trips its own empty value", () => {
    expect(normaliseBrief(emptyBrief())).toEqual(emptyBrief());
  });
});

describe("roomCapacity", () => {
  it("counts beds across class and occupancy, which are separate axes", () => {
    // A deluxe double and a standard double sleep the same number of people:
    // class says how good the room is, occupancy says how many fit.
    expect(roomCapacity([{ roomClass: "deluxe", occupancy: "double", count: 1 }])).toBe(2);
    expect(roomCapacity([{ roomClass: "standard", occupancy: "double", count: 1 }])).toBe(2);
  });

  it("adds extra mattresses per room, not per booking", () => {
    // Two triples with a mattress each is 8 beds, not 7.
    expect(
      roomCapacity([{ roomClass: "standard", occupancy: "triple", extraMattress: 1, count: 2 }])
    ).toBe(8);
  });

  it("totals a mixed set", () => {
    expect(
      roomCapacity([
        { roomClass: "deluxe", occupancy: "double", count: 2 },
        { roomClass: "standard", occupancy: "quad", extraMattress: 1, count: 1 },
      ])
    ).toBe(9);
  });
});

describe("childBand", () => {
  it("bands on the real Indian hotel breaks", () => {
    expect(childBand(1).value).toBe("infant");
    expect(childBand(4).value).toBe("free");
    expect(childBand(5).value).toBe("no-bed");
    expect(childBand(11).value).toBe("no-bed");
    expect(childBand(12).value).toBe("adult-rate");
  });

  it("separates two children a headcount would treat the same", () => {
    // The whole reason children are stored with an age rather than counted.
    expect(childBand(4).value).not.toBe(childBand(11).value);
  });

  it("refuses nonsense rather than guessing", () => {
    expect(childBand(null)).toBeNull();
    expect(childBand("abc")).toBeNull();
    expect(childBand(-1)).toBeNull();
  });
});

describe("traveller counts", () => {
  const party = { adults: 2, children: [{ age: 7 }, { age: 3 }], infants: 1 };

  it("excludes infants from seats, includes them in the total", () => {
    // An infant travels on a lap but still sleeps in the room.
    expect(seatedTravellers(party)).toBe(4);
    expect(totalTravellers(party)).toBe(5);
  });

  it("copes with an empty brief", () => {
    expect(totalTravellers({})).toBe(0);
    expect(totalTravellers(null)).toBe(0);
  });
});

describe("briefGaps", () => {
  it("names what still blocks a quotation", () => {
    expect(briefGaps({ brief: null, departureDate: null, adults: null })).toEqual([
      "departure date",
      "number of adults",
      "hotel category",
      "meal plan",
      "transport",
    ]);
  });

  it("is empty once the brief is usable", () => {
    expect(
      briefGaps({
        departureDate: "2026-06-15",
        adults: 2,
        brief: { hotelCategory: "4-star", mealPlan: "CP", transportModes: ["car"] },
      })
    ).toEqual([]);
  });

  it("accepts a per-stay answer in place of the trip-level one", () => {
    // A multi-city trip sets the category per stay and leaves the trip-level
    // field blank; that is complete, not missing.
    const gaps = briefGaps({
      departureDate: "2026-06-15",
      adults: 2,
      brief: {
        stays: [{ city: "Kaza", nights: 2, hotelCategory: "campsite", mealPlan: "AP" }],
        legs: [{ mode: "car", from: "Shimla", to: "Kaza" }],
      },
    });
    expect(gaps).toEqual([]);
  });
});

describe("summaries", () => {
  it("reads as a line a salesperson can scan", () => {
    expect(
      briefSummary({
        hotelCategory: "4-star",
        mealPlan: "CP",
        rooms: [{ roomClass: "deluxe", occupancy: "double", count: 2 }],
        transportModes: ["car"],
      })
    ).toBe("4 star · Breakfast (CP) · 2 rooms · Car");
  });

  it("states the children's ages, because that is the point of storing them", () => {
    expect(travellerSummary({ adults: 2, children: [{ age: 7 }], infants: 1 })).toBe(
      "2 adults, 1 child (7), 1 infant"
    );
  });

  it("says nothing when there is nothing to say", () => {
    expect(travellerSummary({})).toBe("");
    expect(briefSummary(null)).toBe("");
  });

  it("shows customers plain English and staff the code", () => {
    expect(mealPlanLabel("MAP")).toBe("Breakfast + one meal (MAP)");
    expect(mealPlanLabel("nope")).toBeNull();
  });
});

describe("vocabulary", () => {
  it("covers every category and plan the business asked for", () => {
    for (const v of ["budget", "3-star", "4-star", "5-star", "resort", "villa", "homestay", "campsite"]) {
      expect(HOTEL_CATEGORY_VALUES).toContain(v);
    }
    // EP was added on top of the three that were asked for: without room-only
    // a salesperson has to misuse CP and the quotation promises a breakfast
    // nobody booked.
    expect(MEAL_PLAN_VALUES).toEqual(["EP", "CP", "MAP", "AP"]);
  });
});
