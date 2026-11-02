# A visual page builder — what it would actually take

**Date:** 2026-10-01 · **Role:** CTO
**Trigger:** "I should be able to edit anything… by drag and drop… resize any
text box, button, section, image… even navbars and menus."

## First, the honest gap

What exists is **not** a page builder and was never going to grow into one.

`<Editable>` is an inline **text and image** editor: a developer declares an id
in the JSX, and the admin can rewrite that string, swap that image, hide that
element or apply a style token. 45 fields on the homepage, 17 on About. Every
one of them had to be wrapped by hand, in code.

What is being asked for is a different category of software: **direct
manipulation of layout.** Drag a section above another. Pull a button wider.
Drop a new card into a grid. Rearrange the navbar. Nothing in the current
architecture supports any of that, because the page IS the code — layout lives
in JSX and Tailwind classes, not in data an editor could change.

The two are not on the same road. Wrapping more fields in `<Editable>` gets to
100 editable strings and still cannot move a section.

## The one thing I would push back on

**"Resize anything with the mouse" breaks the mobile site**, which is the thing
this business competes on.

A width dragged by hand is correct at exactly one viewport. Webflow and Framer
solve this by making you lay out each breakpoint separately — so every edit
becomes two or three edits, and you need to think like a designer at each one.
Elementor-style builders skip that, which is why Elementor sites are famously
slow and broken on phones.

The site's whole competitive argument — written down in the UI/UX plan — is that
it is **faster and calmer on a phone** than two 19-section competitors. A
free-form pixel editor is the most direct way to lose that.

**The alternative that keeps it:** drag freely to **reorder and compose**, but
size through constrained steps — a button is S / M / L, a section's padding is
tight / normal / roomy, an image is inset / full-bleed. Direct manipulation,
real control, and every result still works at 360px because the steps are
design-system tokens, not pixels.

That is a judgement call, and it is the user's to make. It is stated here so it
is made deliberately rather than discovered on a phone in three months.

---

## Three real paths

### A · Puck — an open-source visual editor, embedded

[Puck](https://github.com/measuredco/puck) is MIT-licensed, React-native, and
explicitly supports the Next.js App Router. Components are registered in a
config with typed fields; the editor drags and drops **our own components**;
`onPublish` hands back JSON that we store wherever we like. No vendor lock-in,
no hosted dependency, no per-seat cost.

**What it gives:** genuine drag-and-drop of sections and components, a field
panel per component, reordering, add/remove — in our own admin, with our own
design system as the component set.

**What it costs:** every section has to be rewritten from JSX into a registered
Puck component, and page content moves from code into the database. That is the
real work, and it is substantial.

**What it does not give:** free-form pixel dragging. Puck composes blocks; it is
not a canvas.

### B · A block editor of our own

Sections become data — `{ type: "hero", props: {...} }` — rendered by a
registry. Admin reorders by drag, toggles visibility, edits fields, swaps
images.

**Honest comparison:** this is Puck, built by us, worse, over several more
weeks. The only reason to choose it is if Puck's model turns out to fight the
design system badly. Not recommended as a starting point.

### C · Move the marketing pages to Framer or Webflow

True canvas editing, immediately, with no build from us. The CRM and the AI
planner stay in Next.js.

**What it costs:** a split architecture and a monthly fee. The AI planner, Yaadi
and live seat counts are deeply wired into these pages — they would have to be
embedded rather than native, and the "one-question homepage" with a live planner
is exactly the thing that does not survive an embed well.

**When it is right:** if the real goal is "marketing can change pages without a
developer, this week." It is the fastest path to that, and it is not a
humiliating answer.

---

## Recommendation

**Path A, scoped to the marketing pages, in tranches.**

It is the only option that gives real drag-and-drop *and* keeps the design
system, the performance budget, the AI planner and the live inventory intact.

Order of work:

| # | Tranche | What becomes editable |
|---|---|---|
| 1 | Section registry + Puck in the admin, homepage only | Reorder, show/hide, edit and restyle every homepage section |
| 2 | Component-level blocks — cards, CTAs, stats, proof points | Add/remove/reorder items inside a section |
| 3 | About, contact, corporate-travel, customized-tours | Same editing on the rest of the marketing site |
| 4 | Nav and footer as composable blocks | Menu items added, reordered, renamed |
| 5 | Size, spacing and emphasis as token steps | S/M/L on buttons, text and section padding |

Trip pages, the planner, quotations and the CRM stay in code. They are
application surfaces, not marketing pages, and a builder has nothing to offer
them but risk.

## What this is not

It will not be Figma. Dragging a heading twelve pixels left is not on the list
and should not be — that freedom is what makes builder-made sites look
builder-made.

What it will be: **every section and every block on the marketing site
reorderable, editable, hideable and restyleable by hand, without a developer,
and still correct on a 360px phone.**
