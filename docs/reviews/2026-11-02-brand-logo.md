# Brand logo: UI/UX + PM + CTO review

**Date:** 2026-11-02 · **Asked for:** "put the logo on website" (the owner's
logo: a green car with red wheels over a green-and-red "YaadiGo" wordmark,
400×400, white background)

## CTO: what changed

- **One component:** `BrandLogo` (`src/components/brand-logo.js`) renders
  `public/brand/yaadigo-logo.png` through `next/image`.
- **Logo file:** cut from the supplied image. The white margin is trimmed and
  the white made transparent by colour-to-alpha, so the edges blend on cream
  and white alike. Size 388×222.
- **Replaces** the placeholder orange pulse mark and the typed "YaadiGo" in
  every place:
  - main header (50 px);
  - corporate header (34 px, on a white backing);
  - admin sidebar (40 px) and admin phone header (30 px);
  - quotation letterhead (52 px);
  - trip-plan PDF (44 px).
- **Placeholder removed:** `LogoMark` is deleted.
- **Icons:** the car alone, on a white rounded tile, for:
  - the browser tab (`app/icon.png`);
  - iPhone (`app/apple-icon.png`, square, since iOS rounds it);
  - Android home screen (`brand/icon-192.png`, `icon-512.png` in the manifest,
    which listed only an SVG before).
- **Google:** the structured-data `logo` now points at the PNG. Google wants a
  raster image of at least 112 px.
- **Share cards:** the link-preview images show the logo too (F4).

## UI/UX decisions

- **Tab icons:** the car is a 2:1 line drawing and vanished at 16–32 px. The
  icons thicken its lines slightly. The logo itself is untouched.
- **Corporate header:** the dark bar hid the dark green wordmark, so the logo
  sits on a white backing. The colours are not changed.
- **Corporate header, phone:** the logo plus the "For Corporate" label pushed
  "Talk to the desk" onto two lines at 375 px. The label is hidden below `sm`;
  the hero eyebrow says "For Corporate" just below.

## PM review: used, not read

Checked at 2× in headless Chrome against the local store:

- **Main header:** 1440 and 375, correct.
- **Corporate header:** 1440 and 375. Correct after the phone fix.
- **Admin sidebar and admin phone header:** correct (signed in with the
  local QA account).
- **Sent quotation page `/q/…`:** letterhead correct.
- **Quotation PDF:** `/api/q/…/pdf` returns 200. The PDF embeds the logo.
- **Icons:** `/icon.png`, `/apple-icon.png`, `/brand/icon-192.png`,
  `/brand/icon-512.png` and `/manifest.webmanifest` all serve.
  `/icon.svg` is gone (404).
- **Not checked:** the trip-plan PDF, which needs a Gemini plan to exist. It
  uses the same component as the quotation.

## Findings

**F1 (S2): the PDF logo printed soft. Fixed.** Headless Chromium renders at
1×, so the optimiser served a 96×55 logo into the quotation PDF. Documents now
pass `forPrint`, which serves the original file; the PDF carries 388×222.

**F2 (S3): the source logo is 400×400 and slightly JPEG-soft.** At the sizes
used on screen it is sharp at 2×. A large print (a banner, a brochure) would
need a vector or a 2000 px original from whoever designed it. → #191.

**F3 (S4): no visible label on the corporate phone header.** This is a
deliberate trade, recorded here. Not filed.

**F4 (S2): share cards still showed the old pulse mark. Fixed.** This is the
picture WhatsApp shows when someone forwards a trip.

- `og-card.js` and `opengraph-image.js` now draw `OgLogo`: the logo inlined as
  a data URL on a white tile.
- Checked `/opengraph-image` and `/group-tours/goa-beach-weekend/opengraph-image`:
  both 200 with the logo.
