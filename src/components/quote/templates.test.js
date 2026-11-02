import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * What the customer actually receives.
 *
 * Two separate jobs are tested here, and the second matters more.
 *
 * PERSUASION — does the document help an Indian traveller decide? Attractions
 * with pictures, the hotel's real name, who they are booking with.
 *
 * OBLIGATION — does every template state the terms? A template is allowed to
 * choose how much of the TRIP to show. It must never choose which promises
 * the customer is told about. `Cancellation` was rendering only in Detailed,
 * so a quotation sent on the Modern template — described in the picker as
 * "the everyday quotation" — went out with payment terms and no cancellation
 * terms at all. Nothing had been agreed when somebody then cancelled.
 */

vi.mock("@/lib/media", () => ({
  getImage: vi.fn(() => ({ src: "/media/x.jpg", alt: "x", width: 1200, height: 800 })),
}));

const { default: QuotationDocument } = await import("@/components/quote/templates");
const { defaultContent, TEMPLATE_VALUES } = await import("@/lib/crm/quote-content");

const QUOTATION = {
  id: "q1",
  title: "Spiti Valley — 8 nights",
  destination: "Spiti Valley",
  durationDays: 9,
  travellers: 3,
  startDate: "2026-06-15",
  summary: "Shimla up, Manali down.",
  lines: [
    { kind: "hotel", label: "Hotels, 8 nights", unitPrice: 24000, quantity: 1, perPerson: true, amount: 72000 },
  ],
  inclusions: ["Hotels with breakfast", "Private vehicle"],
  exclusions: ["Flights", "Monument entry"],
  subtotal: 118500, discount: 0, taxPercent: 5, tax: 5925,
  total: 124425, perPerson: 41475, currency: "INR",
  itinerary: { days: [{ day: 1, title: "Arrive Shimla", detail: "Airport pickup." }] },
};

function render(templateValue, extra = {}) {
  const content = {
    ...defaultContent(QUOTATION),
    template: templateValue,
    ...extra,
  };
  return renderToStaticMarkup(
    <QuotationDocument quotation={QUOTATION} content={content} />
  );
}

describe("every template states the terms", () => {
  for (const template of TEMPLATE_VALUES) {
    describe(template, () => {
      it("states the cancellation policy", () => {
        const html = render(template);
        // The ladder itself, not just a heading.
        expect(html).toMatch(/cancel/i);
        expect(html).toContain("30 days before departure");
      });

      it("states the payment schedule", () => {
        expect(render(template)).toMatch(/advance/i);
      });

      it("states how to book", () => {
        expect(render(template)).toMatch(/approve|confirm/i);
      });

      it("carries terms and conditions", () => {
        expect(render(template)).toMatch(/availability|subject to/i);
      });

      it("says who they are booking with", () => {
        const html = render(template);
        expect(html).toContain("YaadiGo Networks Pvt Ltd");
      });

      it("gives a contact route", () => {
        const html = render(template);
        // A phone number or an email — never neither.
        expect(html).toMatch(/7373734778|73737 34778|yaadigo\.in/);
      });

      it("shows the total and the per-person figure", () => {
        const html = render(template);
        expect(html).toContain("1,24,425");
        expect(html).toContain("41,475");
      });

      it("shows what is NOT included, so the price cannot grow quietly", () => {
        const html = render(template);
        expect(html).toContain("Flights");
        expect(html).toContain("Monument entry");
      });
    });
  }
});

describe("the named human", () => {
  it("prints the salesperson and their mobile when there is one", () => {
    const html = render("modern", { owner: { name: "Priya Sharma", phone: "+919811122233" } });
    expect(html).toContain("Priya Sharma");
    expect(html).toContain("+919811122233");
  });

  it("still renders when nobody is named", () => {
    // Older quotations have no owner on the content block.
    expect(() => render("modern", { owner: null })).not.toThrow();
  });
});

describe("what the traveller will see", () => {
  const highlights = [
    { title: "Key Monastery", detail: "A thousand years old, above the Spiti river.", imageId: "key" },
    { title: "Chandratal", detail: "Camp by the lake at 4,300m.", note: "Weather permitting" },
  ];

  it("shows attractions on the templates that sell", () => {
    // Modern and Detailed are the ones sent to somebody still deciding.
    for (const template of ["modern", "detailed"]) {
      const html = render(template, { highlights });
      expect(html, template).toContain("Key Monastery");
      expect(html, template).toContain("A thousand years old");
    }
  });

  it("renders a highlight that has no photograph yet", () => {
    // Waiting for photography would mean shipping nothing; a named stop with
    // an honest line still earns its place.
    const html = render("modern", { highlights: [{ title: "Chandratal", detail: "Camp by the lake." }] });
    expect(html).toContain("Chandratal");
  });

  it("hides the block entirely when there is nothing real to show", () => {
    // A generic "visit the beautiful valley" is worse than silence.
    expect(render("modern", { highlights: [] })).not.toContain("What you will see");
  });

  it("names the hotel rather than saying 'or similar'", () => {
    const html = render("detailed", {
      hotels: [{ name: "Hotel Deyzor", city: "Kaza", nights: 3 }],
    });
    expect(html).toContain("Hotel Deyzor");
  });

  it("shows the day-by-day", () => {
    expect(render("modern")).toContain("Arrive Shimla");
  });
});

describe("robustness", () => {
  it("renders with an empty content block", () => {
    expect(() =>
      renderToStaticMarkup(<QuotationDocument quotation={QUOTATION} content={{}} />)
    ).not.toThrow();
  });

  it("renders a quotation with no itinerary at all", () => {
    const bare = { ...QUOTATION, itinerary: null };
    expect(() =>
      renderToStaticMarkup(
        <QuotationDocument quotation={bare} content={defaultContent(bare)} />
      )
    ).not.toThrow();
  });

  it("falls back to a known template when the stored one is nonsense", () => {
    expect(() => render("gothic-revival")).not.toThrow();
  });
});
