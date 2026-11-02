import { describe, it, expect } from "vitest";
import { splitTax, stateByCode, stateOfGstin, validGstin } from "@/lib/crm/gst";

describe("GSTIN", () => {
  it("accepts a well-formed number and reads its state", () => {
    expect(validGstin("07AAACY1234A1Z5")).toBe(true);
    expect(stateOfGstin("07AAACY1234A1Z5")?.name).toBe("Delhi");
  });

  it("refuses the wrong length, a bad state code or a missing Z", () => {
    expect(validGstin("07AAACY1234A1Z")).toBe(false);
    expect(validGstin("99AAACY1234A1Z5")).toBe(false);
    expect(validGstin("07AAACY1234A1X5")).toBe(false);
    expect(validGstin("")).toBe(false);
  });

  it("is forgiving about case and spaces", () => {
    expect(validGstin(" 07aaacy1234a1z5 ")).toBe(true);
  });
});

describe("tax split", () => {
  it("splits CGST/SGST inside the supplier's state, and the halves sum to the tax", () => {
    const split = splitTax(3055, "07", "07");
    expect(split.kind).toBe("cgst-sgst");
    expect(split.cgst + split.sgst).toBe(3055);
    expect(split.igst).toBe(0);
  });

  it("charges IGST across states", () => {
    expect(splitTax(3055, "07", "27")).toEqual({ kind: "igst", igst: 3055, cgst: 0, sgst: 0 });
  });

  it("falls back to IGST when the place of supply is unknown", () => {
    expect(splitTax(100, "07", null).kind).toBe("igst");
  });

  it("knows its state codes", () => {
    expect(stateByCode("7")?.name).toBe("Delhi");
    expect(stateByCode("38")?.name).toBe("Ladakh");
  });
});
