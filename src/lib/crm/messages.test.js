import { describe, it, expect } from "vitest";
import {
  MESSAGE_TEMPLATES,
  renderMessage,
  templatesFor,
  whatsappTo,
  mailTo,
} from "@/lib/crm/messages";

const lead = { name: "Anita Deshmukh", destination: "Kerala", phone: "9876543210" };
const me = { name: "Priya Sharma" };
const quotation = { title: "Kerala Backwaters & Hills", total: 120225, travellers: 2 };
const booking = { name: "Anita Deshmukh", tripTitle: "Kerala 6D", reference: "YG26-A813J", total: 120225 };

describe("whatsappTo", () => {
  it("prefixes 91 on a bare Indian mobile", () => {
    expect(whatsappTo("9876543210", "hi")).toContain("wa.me/919876543210");
  });

  it("strips the formatting people actually type", () => {
    // wa.me fails SILENTLY on + and spaces — the salesperson sees WhatsApp
    // open on a blank search and assumes the customer has no WhatsApp.
    expect(whatsappTo("+91 98765 43210", "hi")).toContain("wa.me/919876543210");
    expect(whatsappTo("098765-43210", "hi")).toContain("wa.me/919876543210");
  });

  it("leaves a number that already has a country code alone", () => {
    expect(whatsappTo("971501234567", "hi")).toContain("wa.me/971501234567");
  });

  it("returns null rather than a broken link when the number is unusable", () => {
    expect(whatsappTo("", "hi")).toBeNull();
    expect(whatsappTo("12345", "hi")).toBeNull();
    expect(whatsappTo(null, "hi")).toBeNull();
  });

  it("url-encodes the message, including newlines", () => {
    const url = whatsappTo("9876543210", "line one\nline two & more");
    expect(url).toContain("%0A");
    expect(url).toContain("%26");
  });
});

describe("renderMessage", () => {
  it("uses the first name only, for both sides", () => {
    const text = renderMessage("first-contact", { lead, me });
    expect(text).toContain("Anita");
    expect(text).not.toContain("Deshmukh");
    expect(text).toContain("Priya");
    expect(text).not.toContain("Sharma");
  });

  it("names the destination", () => {
    expect(renderMessage("first-contact", { lead, me })).toContain("Kerala");
  });

  it("formats money rather than printing a raw number", () => {
    const text = renderMessage("quote-sent", { lead, quotation, me, url: "https://x.test/q/abc" });
    expect(text).toContain("1,20,225");
    expect(text).not.toContain("120225");
  });

  it("includes the quotation link", () => {
    const text = renderMessage("quote-sent", { lead, quotation, me, url: "https://x.test/q/abc" });
    expect(text).toContain("https://x.test/q/abc");
  });

  it("degrades to something sendable when fields are missing", () => {
    // A half-filled lead must not produce "Hello undefined".
    const text = renderMessage("first-contact", { lead: {}, me: {} });
    expect(text).not.toMatch(/undefined|null|NaN/);
    expect(text).toContain("there");
  });

  it("never leaves a triple newline", () => {
    for (const t of MESSAGE_TEMPLATES) {
      const text = renderMessage(t.id, { lead, me, quotation, booking, amount: 50000, url: "https://x.test" });
      expect(text).not.toMatch(/\n{3,}/);
      expect(text.trim()).toBe(text);
    }
  });

  it("returns null for an unknown template", () => {
    expect(renderMessage("no-such-template", { lead })).toBeNull();
  });
});

describe("templatesFor", () => {
  it("offers only what the context can fill", () => {
    const ids = templatesFor({ lead }).map((t) => t.id);
    expect(ids).toContain("first-contact");
    // No quotation yet, so offering "quotation sent" would produce a message
    // with a hole in it.
    expect(ids).not.toContain("quote-sent");
    expect(ids).not.toContain("payment-link");
  });

  it("opens up as the deal progresses", () => {
    const ids = templatesFor({ lead, quotation, booking }).map((t) => t.id);
    expect(ids).toContain("quote-sent");
    expect(ids).toContain("payment-link");
    expect(ids).toContain("pre-departure");
  });
});

describe("mailTo", () => {
  it("builds a mailto with subject and body", () => {
    const url = mailTo("a@b.test", "Your quotation", "Hello\nthere");
    expect(url).toMatch(/^mailto:a@b\.test\?/);
    expect(url).toContain("subject=Your+quotation");
    expect(url).toContain("body=Hello%0Athere");
  });

  it("returns null without an address", () => {
    expect(mailTo(null, "s", "b")).toBeNull();
  });
});
