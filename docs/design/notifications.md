# UI/UX spec — notification bell

**Backlog #1 · S1 · Blocks: notifications are written and never shown**

## The job

A salesperson needs to know a lead arrived without watching the leads page. Ops
needs to know a booking was handed over. Right now both are written to storage
and neither is visible anywhere.

## Placement

Admin header, right of "View site", **left** of "Sign out" — so a mis-tap
between them is harmless in one direction and a sign-out in the other is
avoided. Present on both the mobile header and the desktop sidebar.

## States

**Zero unread** — outline bell, no badge. Not hidden: absence of a badge is the
information.

**Unread** — filled accent dot on the bell. Count in the badge up to 9, then
`9+`. A three-digit badge is noise; the desk only needs "some" versus "many".

**Panel open** — sheet from the bottom on phone, popover on desktop. Newest
first, max 30. Each row: title, one line of detail, relative time.

**Read vs unread** — unread rows carry a small accent dot and a slightly
stronger background. Read rows stay visible, dimmed. Removing them on read makes
the panel jump under the thumb mid-tap.

**Empty** — *"Nothing new. Enquiries and bookings will show up here."*

**Loading** — three skeleton rows at row height, not a spinner.

**Error** — *"Couldn't load notifications."* with a retry. The bell still opens.

## Interaction

- Opening the panel does **not** mark everything read. Someone opening it to
  glance, then locking their phone, must not lose the queue.
- Tapping a row marks that one read and navigates to its `href`.
- "Mark all read" is an explicit text button in the panel header.
- Unread count refreshes on navigation. No polling — the desk is on mobile data
  and a 30-second poll is a background battery drain for a handful of rows.

## Why it is not a toast

Toasts vanish. The desk is between calls and will miss them. A persistent count
survives the phone going in a pocket, which is the actual usage pattern.

## Acceptance criteria

- [ ] Bell visible on mobile header and desktop sidebar
- [ ] Badge shows unread count, `9+` above nine
- [ ] Panel lists newest first with relative times
- [ ] Tapping a row marks it read and navigates
- [ ] "Mark all read" clears the badge
- [ ] Opening the panel alone does NOT mark read
- [ ] Empty, loading and error states all present
- [ ] Only the signed-in user's notifications are returned — verified by signing
      in as a second user
