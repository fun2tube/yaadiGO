import { describe, it, expect, beforeAll } from "vitest";
import { signedQuery, verifySignature } from "./sign";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "test-secret-at-least-sixteen-chars";
});

const parse = (query) => Object.fromEntries(new URLSearchParams(query));

describe("PDF render signatures", () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0);

  it("verifies a fresh signature for the same document", () => {
    const { exp, sig } = parse(signedQuery("quotation", "q_1", now));
    expect(verifySignature("quotation", "q_1", exp, sig, now)).toBe(true);
  });

  it("refuses another document, another kind, or a tampered signature", () => {
    const { exp, sig } = parse(signedQuery("quotation", "q_1", now));
    expect(verifySignature("quotation", "q_2", exp, sig, now)).toBe(false);
    expect(verifySignature("itinerary", "q_1", exp, sig, now)).toBe(false);
    expect(verifySignature("quotation", "q_1", exp, `${sig.slice(0, -1)}A`, now)).toBe(false);
  });

  it("expires after five minutes", () => {
    const { exp, sig } = parse(signedQuery("quotation", "q_1", now));
    expect(verifySignature("quotation", "q_1", exp, sig, now + 299_000)).toBe(true);
    expect(verifySignature("quotation", "q_1", exp, sig, now + 301_000)).toBe(false);
  });

  it("refuses a pushed-out expiry, a missing signature and junk", () => {
    const { sig } = parse(signedQuery("quotation", "q_1", now));
    const farFuture = Math.floor(now / 1000) + 86_400;
    expect(verifySignature("quotation", "q_1", farFuture, sig, now)).toBe(false);
    expect(verifySignature("quotation", "q_1", "", "", now)).toBe(false);
    expect(verifySignature("quotation", "q_1", "abc", undefined, now)).toBe(false);
  });
});
