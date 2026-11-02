# Design — the website as an answer engine

**Date:** 2026-09-30 · **Role:** UI/UX + content · **Follows:** the competitor
audit of pickyourtrail.com and tripclap.com

## The one-line brief

> **Ask, do not browse. Watch, do not read.**

The site has one input — spoken or typed — and answers in video. Everything
else on the page is the fallback for people who want to browse, and it stays
complete, because a chat-only site locks out anyone who just wants a list.

---

## Why this, and not a chatbot

A chat box bolted onto a travel site fails for a reason that is well understood
and rarely designed around: **the blank prompt.** People do not know what to
type, so they type one word, get a generic answer, and leave. TripClap ships
theirs labelled "AI BETA", which tells the visitor it does not work yet.

The difference that matters is not having AI. It is **what the AI is allowed to
touch.**

- Their AI *talks about* the catalogue.
- Ours should **operate** it — filter it, compare it, price it, re-render the
  page underneath the conversation.

Yaadi already calls tools against real inventory. The change is that those tools
return **UI actions, not prose**. Asking "show me Ladakh under 40k in June"
should change what is on screen, not describe what would be on screen.

That is the thing neither competitor has, and it is not a feature they can copy
in a sprint, because it requires owning the inventory.

---

## Why video, and not a video hero

Pickyourtrail already has a full-width video hero. Decorative video is table
stakes and differentiates nothing.

The move is **video as the answer format**:

- Vertical 9:16, 10–20 seconds, muted autoplay, burnt-in subtitles — the format
  the Indian phone audience already consumes all day on Reels and Shorts.
  Landscape hero loops are a Western desktop convention.
- Asked "how is the hotel in Pahalgam?", Yaadi plays fifteen seconds of *that
  hotel*, not a paragraph about it.
- Trip pages lead with a 30-second reel instead of a photo carousel.

This fuses with the first idea rather than sitting beside it:
**an AI that answers in video.** Nobody in this market does that.

---

## The design plan

### 1 · One question, answerable by voice

Above the fold on a phone: the name, one line of positioning, one input —
*"Where do you want to go?"* — with a **real, tappable mic button**, not a small
grey icon. Hindi and Hinglish accepted.

Voice is the highest-leverage, lowest-cost item in this document. Many Indian
users type English slowly and speak it fluently; the Web Speech API is free and
works well in Chrome on Android, which is the dominant device here. No Indian
travel site offers it.

Chips underneath for people who will not speak or type: Ladakh, Kerala, Bali,
Vietnam.

Competitors run 18 and 19 homepage sections. We run one question. Restraint is
the differentiation, and it costs nothing but discipline.

### 2 · The conversation drives the page

Yaadi gains tools whose effect is visible:

| Tool | What the visitor sees |
|---|---|
| `filterCatalogue({destination, month, budget})` | the grid below re-renders |
| `compare([a, b])` | a side-by-side card appears |
| `showClips(topic)` | the video answer plays inline |
| `buildItinerary(...)` | the day-by-day streams in, day by day |

Watching the plan write itself is the moment that earns a phone number. Stream
it; never show a spinner and then a finished block.

### 3 · Comparison is a product, not a feature

*"Kerala or Andaman for a honeymoon in November?"* returns a real side-by-side:
price from our catalogue, weather, flight time, pace, who each one suits — and
ends with **one recommendation and the reason for it.**

### 4 · Narrow to three, recommend one

Everywhere: search, AI output, comparison. Researching a trip in India is a
fifteen-tab activity. **The site that ends the research wins the booking.**
Ten options is a search result; one recommendation with a reason is advice, and
advice is what is actually being shopped for.

### 5 · The plan is an artefact

The Trip Card: shareable link, prints to PDF, no signup, and carrying a
20-second video summary so it survives being forwarded on WhatsApp — which is
where Indian trip decisions are actually made.

### 6 · Capture at peak value

Under a finished plan the visitor likes:
**"Have a travel expert check this and price it — free."**

Plus a **voice note** option — record the question, we reply on WhatsApp. Lower
friction than any form, and native to how this audience already communicates.

Not a gate. Not a modal. Not on arrival.

### 7 · Honest inventory as the trust signal

*"4 seats left on the 12 Oct batch"* beats any badge, because it is verifiably
true and neither competitor can show it — Pickyourtrail does not run group
departures and TripClap is a broker. Our seat counts are real. Show them.

### 8 · Mobile rules, non-negotiable

- Mic and primary action in the thumb zone, always.
- Video: poster first, lazy, one playing at a time, `prefers-reduced-motion` and
  data-saver respected.
- One question per screen.
- A visible text alternative to every video — for accessibility, for silent
  contexts, and for the sizeable minority who would rather read.

---

## The content plan

**The reframe: this is a production plan, not a writing calendar.**

### Tier 1 · The clip library — the moat

Every departure returns with footage. This is an **operations requirement, not
a marketing request.** Target 20–30 clips per destination: hotel rooms, meals,
transport, the hard parts (altitude, road conditions, weather), the highlights.
Vertical, subtitled, 10–20 seconds, tagged by destination / hotel / activity /
month / traveller type so the AI can retrieve them.

This is the expensive tier and the only one competitors cannot copy.
Pickyourtrail does not operate the trips; TripClap is a marketplace. Neither has
original footage of **our** departures.

### Tier 2 · Answer pages — written for machines

Google and AI assistants read text. Each page answers one specific question and
carries its matching clips:

- "Ladakh in June vs September"
- "Is Ladakh safe with a six-year-old?"
- "Kerala honeymoon — backwaters or hills?"

Decision queries, not "Top 10" listicles. Uncontested, and where the buying
intent lives.

### Tier 3 · Programmatic pages from real inventory

Destination × month × traveller type, generated from departures we actually
operate, with real prices and real seat counts. Thin AI pages get penalised;
pages backed by inventory do not.

### Tier 4 · Trip diaries

*"What actually happened on the 14 Oct batch."* Dated, photographed, filmed.
Rohtang shut and here is how we rerouted. Unfakeable trust content — wire it to
operations so it publishes as a by-product of running trips.

### Tier 5 · Voice-shaped FAQ

Because people will **speak** the question, the copy must answer spoken
phrasing — *"how cold is Ladakh in June"*, not *"Ladakh June temperature"*.
Conversational long-tail is also precisely what AI assistants retrieve when
someone asks one for an operator recommendation.

### Distribution

Every clip is natively a Reel and a Short. **Produce once, publish three
places.** The website is the library; social is the sampler that points at it.

---

## Risks, stated plainly

1. **Footage is the bottleneck, not code.** The build is weeks; the clip library
   is a quarter of operational discipline. Without it this plan is a chat box on
   an ordinary website. **Start capturing before building.**
2. **Voice is weaker on iOS Safari** than on Android Chrome. India is
   Android-dominant so it remains worth doing, but typing stays equally
   prominent, and the transcript is always shown so it can be corrected.
3. **Hinglish place-name recognition is imperfect.** Never act on a transcript
   without displaying it.
4. **Video wrecks mobile performance if done naively.** Posters, lazy loading,
   one at a time, data-saver honoured. Measure on a mid-range Android, not a
   laptop.
5. **Chat-first is a real bet.** Every competitor believes dense browsing
   homepages work. Doing the opposite is deliberate — but keep the full browse
   path visible, and keep the dense version as a measured fallback.
