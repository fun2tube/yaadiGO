# Review — notification bell

**Date:** 2026-09-28 · **Backlog:** #1 (S1) · **Spec:** `docs/design/notifications.md`

## PM review — against the acceptance criteria

| Criterion | Result |
|---|---|
| Bell visible on mobile header and desktop sidebar | ✅ renders in shell |
| Badge shows unread count, `9+` above nine | ✅ |
| Panel lists newest first with relative times | ✅ 8 rows |
| Tapping a row marks it read and navigates | ✅ `{changed:1, unread:8→7}` |
| "Mark all read" clears the badge | ✅ `{changed:7, unread:0}` |
| Opening the panel alone does NOT mark read | ✅ by construction |
| Empty / loading / error states present | ✅ all three |
| Only the signed-in user's rows returned | ✅ see CTO review |

**Passed.**

## CTO review — correctness and safety

**Isolation verified with a second real account.** Invited Priya (sales),
accepted, approved, signed in:

```
admin sees                       8 rows
priya sees                       0 rows
priya marking admin's row read   {changed: 0}   ← refused silently, correctly
priya sees the Team tab          0              ← permission gating holds
unauthenticated                  401
```

Scoping is by session, never by a client-supplied id. `markRead` filters on
`userId` as well as row id, so a guessed id belonging to someone else matches
nothing rather than marking their notification read. That is the right shape: no
error to probe with, no leak.

**A defect the linter caught, and the fix was better than the original.**
The first implementation loaded on mount and on every navigation via an effect.
`react-hooks/set-state-in-effect` refused it. Rather than silencing the rule, the
count moved to the server (rendered with the shell) and the rows now fetch only
when the panel opens.

That is strictly better: the badge is correct on first paint instead of
flickering in, and a desk that never taps the bell issues no request at all —
which matters on mobile data. The lint rule was right and the original design
was lazy.

**No findings.**

## Status

Backlog #1 — **Done.** Both reviews passed.

Note for the next module: this is the first S1 in the review log closed by
building the *user-facing* half of something whose back end already existed.
Two more of the same kind remain (#2 operations, #4 lead detail), and they are
the same defect class the full-system review named.
