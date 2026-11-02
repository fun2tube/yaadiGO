# UI/UX spec — quotation templates

**New · The document that closes the sale**

## What this document is actually for

A traveller comparing four agencies opens four quotations. Three are a table of
numbers in an email. The one that looks like a *proposal* — with the place they
want to go on it, a day-by-day they can picture, and a clear "here is how you
book" — wins disproportionately, even at the same price.

So this is not a formatted invoice. It is the pitch.

## Three templates, and when each wins

**Simple** — one page, price-forward. A returning customer, a repeat route, or
someone who has already decided and wants the number. Logo, trip summary,
costing, how to book. Minimal images: decoration slows a decision that is
already made.

**Modern** *(default)* — hero image, day cards, inclusions as chips. The
everyday quotation for a first-time enquiry. Persuasive without being a
brochure.

**Detailed** — everything: full day-by-day with per-day images, hotel list with
photos, flight details, payment schedule, cancellation policy, FAQ. For
high-value and international trips, where the customer is being asked for
₹2,00,000+ and needs to feel the operator has thought it through.

The salesperson picks. The system does not guess: a ₹15,000 Goa weekend sent on
the Detailed template reads as padding, and a ₹3,00,000 Europe trip on Simple
reads as careless.

## Anatomy

| Block | Simple | Modern | Detailed |
|---|---|---|---|
| Logo + quotation number | ✅ | ✅ | ✅ |
| Hero image | — | ✅ | ✅ |
| Trip overview (2–3 lines) | ✅ | ✅ | ✅ |
| At-a-glance (nights, pax, dates) | ✅ | ✅ | ✅ |
| Day-by-day | condensed list | day cards | cards + per-day image |
| Hotels | names only | names + nights | photo, nights, room type |
| Flights | — | if included | detail + screenshot |
| Costing breakdown | ✅ | ✅ | ✅ + per-person split |
| Payment policy | one line | schedule | schedule + cancellation |
| Inclusions / exclusions | ✅ | ✅ | ✅ |
| How to book | ✅ | ✅ | ✅ |
| Terms | link | short | full |

## Images — and the honest limit

- **Destination and day images** come from the existing media library (36
  licence-verified images). Staff pick; alt text and credit come with them.
- **Hotel and flight images** are pasted URLs for now. There is no file upload
  because there is no object storage yet — that arrives with Supabase Storage.
  The field says "paste a link" rather than pretending a picker exists.
- **The logo** is `BrandLogo` (`public/brand/yaadigo-logo.png`, the owner's logo, transparent PNG), 52 px tall on the letterhead.

A missing image must never leave a broken frame or an empty box. Blocks with no
image collapse entirely — an absent hotel photo should look like a decision,
not a fault.

## Print

Same mechanism as today: a print stylesheet and the browser's Save-as-PDF. A4,
`break-inside: avoid` on every day card and the costing table, backgrounds
forced on so the totals panel and status colours survive.

Each template gets its own print rules. Detailed is the one that breaks badly
by default — a twelve-day itinerary splits a day card across a page boundary
and reads as a printing error.

## Writing

The tone that sells a trip is specific, not adjectival. "Tibumana and Tukad
Cepung falls, then Tirta Empul — sarongs required and provided at the temple"
beats "immerse yourself in breathtaking natural beauty."

Costing is stated plainly. No asterisks, no "starting from" on a figure that is
not the figure. A customer who feels a number is hedged assumes every number is.

## Acceptance criteria

- [ ] Three templates, selectable on the quotation, stored on the record
- [ ] The customer link renders the chosen template
- [ ] Hero and per-day images selectable from the media library
- [ ] Hotel and flight blocks accept a pasted image URL
- [ ] A missing image collapses its block rather than leaving a gap
- [ ] Payment schedule, terms and how-to-book have sensible defaults
- [ ] Each template prints to A4 without splitting a day card
- [ ] Changing template does not alter a single figure
