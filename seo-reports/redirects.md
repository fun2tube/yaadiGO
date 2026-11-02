# Redirects

**None. No URL was changed in any phase of this work.**

This file exists so that the rule has somewhere to be enforced:

> Never change a URL that already exists without adding a 301 redirect from the old URL
> and listing it here. Ask before changing any URL pattern.

## Current URL shape, for reference

Confirmed against the running site, so a future change can be measured against it:

| Pattern | Count | Notes |
|---|---|---|
| `/` | 1 | |
| `/group-tours`, `/group-tours/[slug]` | 1 + 14 | |
| `/customized-tours`, `/customized-tours/[slug]` | 1 + 20 | 13 currently in the sitemap |
| `/blog`, `/blog/[slug]` | 1 + 8 | |
| `/about` `/contact` `/plan` `/corporate` `/corporate-travel` `/privacy` `/terms` `/credits` `/media` | 9 | |
| `/q/[token]` | n | `noindex` — customer quotation links |
| `/admin/*` | n | `noindex, nofollow` |

`sitemap.xml` lists 54 URLs, each with `lastmod`.

## Behaviour already in place

- A trailing slash 308-redirects to the canonical form (`/group-tours/` → `/group-tours`).
  Verified.
- Every public template carries a self-referencing `rel=canonical`. Verified.
- An unknown path returns a genuine 404, not a soft 200. Verified.

## If a URL does need to change

1. Ask first. This is in the brief and it is not a formality — `/group-tours/[slug]` URLs
   are pasted into WhatsApp threads and quotation documents, which no redirect map reaches
   and nobody can re-issue.
2. Add the 301 before shipping the new URL, not after.
3. Record it in the table below.
4. Update `sitemap.js`, and check `llms.txt` — it is generated from the catalogue, so it
   follows automatically, but confirm rather than assume.

| Old URL | New URL | Status | Date | Reason |
|---|---|---|---|---|
| _(none)_ | | | | |
