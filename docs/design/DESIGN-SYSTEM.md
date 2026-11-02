# Design system

The rules the admin is built to. Written down because the panel has grown by
accretion and every new screen has re-invented its own spacing.

## Who is actually using this

A travel desk on an Android phone, one-handed, between calls, in patchy
signal. Not an analyst at a desk. Every decision below follows from that.

Consequences that are easy to forget:
- The primary action must be reachable by a thumb — bottom of the screen, not top.
- A tap that needs a round trip must show its result optimistically; the desk
  will not wait 3 seconds to see a status pill change.
- Nothing important may live only in a hover state.
- Text below 12px is unreadable in sunlight. 12.5px is the floor for anything
  a person must read; 9.5px mono is for labels only.

## Tokens

Defined in `globals.css`. Never write a raw colour in a component.

```
ink / ink-text              near-black surfaces, inverted text
paper / paper-dim / card    page, sunken, raised
paper-line / -strong        hairline, visible border
paper-text / -muted / -faint   primary, secondary, tertiary
accent / -deep / -bright    clay — actions and focus
good · warn · danger        status only, never decoration
```

**No gradients anywhere.** This was an explicit instruction and it holds.

**Status colour is meaning, not mood.** `warn` on a booking means money is
outstanding. If it starts appearing because a card looked plain, the colour
stops carrying information.

## Type

```
font-display   Fraunces      headings, figures that matter
font-body      Public Sans   everything read as prose
font-mono      JetBrains     labels, references, timestamps, ids
```

`.eyebrow` — mono, uppercase, 9.5px, `tracking-[0.12em]`, faint. Section labels.
Headings: 26px page title, 24px detail title, 14–15px card title.
Body: 13–14px. Secondary: 12.5px. Never below that for real content.

## Spacing and shape

- Cards `rounded-2xl`, inputs and buttons `rounded-xl`, pills `rounded-lg`.
- Card padding `p-4` on phone. Gaps `gap-2.5` between cards, `gap-1.5` in lists.
- Sections separated by `mt-7`, never a horizontal rule.
- Tap targets ≥ 44px. A 32px icon button fails on a moving bus.

## The five states — every screen, no exceptions

This is the single most-skipped item in this project and the reason it is a
checklist item in `PROCESS.md`.

1. **Empty** — say what will appear here and how to make it appear. *"No seat
   requests yet. They arrive the moment someone reserves on a trip page."* Never
   a bare "No data".
2. **Loading** — skeletons matching final layout, not a spinner. A spinner in the
   middle of a page tells the reader nothing about what is coming.
3. **Error** — what failed, in plain words, and what to do. Never a code.
4. **Permission denied** — should not be reachable. The nav hides what a person
   cannot open, and the page redirects if they type the URL.
5. **Partial failure** — the honest one. When an agent applied half a change
   before failing, say so. Never claim "nothing was saved" when something was.

## Writing

Plain, warm, specific. No brochure adjectives, no exclamation marks, no emoji.

Error messages name the thing and the fix:
- ✅ *"Only 2 seats left on that batch."*
- ❌ *"Operation failed."*

Say what an action will do **before** it is taken, where it is irreversible or
moves stock: *"Take 2 seats off this batch? The website stops offering them
immediately."*

Never promise something the system did not do. This is the rule that governs
every unconfigured-provider message in the codebase.

## Navigation

Bottom tab bar on phone (max 5), sidebar from `lg`. One `TABS` array drives
both, filtered by permission, so a new module cannot appear in one and not the
other.

## Forms

- Label above, not placeholder-as-label — a placeholder vanishes the moment
  someone types and they lose the question.
- Errors inline, next to the field.
- Primary action full-width on phone.
- Money fields `inputMode="numeric"` and prefixed with the unit.
- Destructive actions confirm in place, never with a browser `confirm()`.

## Components already standard

`StatusPill` · `Stat` card · expandable card (header always shows what you need
to decide whether to open it) · chip list · sticky totals panel · copyable link
row.
