# Review — why the AI planner always said "under heavy load"

**Date:** 2026-09-30 · **Sev:** S1 (the headline feature was dead) · **Role:** DevOps → CTO

Three separate faults, stacked. Each one alone would have been survivable; the
combination made the planner fail on roughly every attempt and report the wrong
reason for it.

---

## My first hypothesis was wrong, and worth recording

I assumed "The planner is under heavy load right now" was a catch-all hiding a
real error — a bad key, a quota, a crash. It was not. The message mapped
correctly from a genuine `503 UNAVAILABLE`, and the key was valid.

**Checking the API directly before changing any code is what found the real
cause.** Had I trusted the hypothesis, the first fix would have been to a
message that was already accurate.

---

## Fault 1 · S1 · A model that will never work looks identical to one that is busy

`gemini-3.8-flash` was configured. That model **is not served on this key** —
it is not in `GET /v1beta/models`, and never returns a completion.

The trap: **Gemini answers for it with `503 UNAVAILABLE`, not `404 NOT_FOUND`.**

```
gemini-3.8-flash   503 UNAVAILABLE — "experiencing high demand… try again later"
gemini-3.6-flash   200 OK
gemini-3.5-flash   200 OK
```

So a permanently broken configuration presented as a transient one, forever, and
the planner truthfully told every visitor to try again in a few seconds.

**Fixed:** default model is now `gemini-3.6-flash`, verified end to end including
`responseJsonSchema` and `thinkingConfig`. The 503 branch of `describeError` now
names the model in development and says the two causes are indistinguishable, so
this cannot cost an afternoon twice.

**Added:** `npm run ai:doctor` lists what the key advertises, then **probes each
one**, because listed and servable are different things — 44 advertised, 18 text
candidates, 6 actually working.

## Fault 2 · S1 · The free tier drops the stream, and the SDK discards the response

With the model corrected, a different error appeared — `Incomplete JSON segment
at the end`, thrown from the SDK's `processStreamResponse` when the reader
finishes with an unconsumed partial event in its buffer.

Not the schema, not the model. **Measured, identical request repeated:**

```
run 1  THREW after 26 chunks / 2668 chars
run 2  OK    67 chunks / 7356 chars
run 3  THREW after 0 chunks / 0 chars
run 4  THREW after 0 chunks / 0 chars
run 5  THREW after 0 chunks / 0 chars
```

Roughly half, and failing two different ways: usually nothing arrives, sometimes
it dies part-way. Non-streamed `generateContent` did not fail once under the same
conditions — one request, one response, nothing to truncate.

**Fixed:** a broken stream now retries once non-streamed. The generation appears
all at once instead of day by day, which is a far better outcome than the error
half of all visitors were getting.

## Fault 3 · The actual answer to "find a free solution"

The 429 body carries the number that matters:

```
Quota exceeded for metric: generate_content_free_tier_requests
limit: 20, model: gemini-3.6-flash
quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier
```

**Twenty requests per day — and the quota is per MODEL, not per key.** About
twenty of my own test generations exhausted it, while `gemini-3.5-flash` on the
same key kept answering 200.

That is the free strategy: a ladder of five working models is roughly **100
generations a day for no money and no extra accounts.**

**Fixed:** `streamJson` and `generateJson` walk a ladder, demoting on 429/503 and
returning to the preferred model after an hour so a daily reset is picked up.
Full `flash` models first, `lite` last — the lite variants drop detail on long
itineraries, and a plainer itinerary still beats an apology.

`streamWithTools` resolves its model **once** and holds it for the whole
conversation, deliberately: `thoughtSignature` must be echoed back to the model
that issued it, so switching mid-conversation would corrupt the history.

---

## A bug I introduced, and how the log caught it

After the ladder landed, one run in three still failed — six days streamed, then
"produced something we couldn't read".

The reset signal fired only on the **non-streamed** retry path, not when the
ladder moved to the **next model**. So six days of one model's JSON sat in the
extractor, a whole fresh document streamed in behind it, and the concatenation
was unparseable.

Both retry paths now announce a fresh attempt through one `beginAttempt()`
generator. Guarding one path and not the other is the kind of fault that only
shows up as an intermittent failure, which is exactly how it presented.

---

## Verified

```
planner, primary model still out of quota:   5 / 5 complete, 6 days each
Yaadi concierge:                              200 — called search_trips, real prices and seats
test suite:                                   37 / 37 passing
```

Log from the live fallback, working as designed:

```
[ai] gemini-3.6-flash unavailable (429); falling back to gemini-3.5-flash
[ai] gemini-3.5-flash stream broke mid-response; retrying non-streamed
[ai] gemini-3.5-flash unavailable (503); falling back to gemini-3-flash-preview
```

**Not verified:** the hour-based return to the preferred model — it needs an hour
of wall-clock to observe, and I did not fake the clock. The logic is three lines
and reviewed, but it is untested.

One cosmetic artefact: a run that resets mid-stream can emit one more `day`
event than the trip has days. Harmless, because the client replaces its streamed
preview with the authoritative `complete` document — but it is visible for a
moment if you watch closely.

---

## The honest limit

**~100 generations a day is thin for a site whose entire strategy is being a
lead magnet.** It is fine now and it will not survive traffic.

When it stops being enough, the adapter already supports Groq, Cerebras,
Together, Mistral and OpenRouter free tiers, all on open-weight models, all one
env var:

```
AI_PROVIDER=groq
GROQ_API_KEY=…        # console.groq.com/keys
```

Groq's free tier is considerably more generous per day than Gemini's twenty, and
`strictJson: true` is already set for it. That is the next move on this feature,
and it needs a key rather than code.
