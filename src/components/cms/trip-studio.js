"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TRIP_STATUSES, publishProblems } from "@/lib/trip-model";
import { TripPanel } from "@/components/cms/trip-editor";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * The trip editor (docs/design/trip-management.md §5.2).
 *
 * Everything about a trip in one place, phone first. Two rules shape it:
 *
 *   - SAVE never changes the website. It stores a draft.
 *   - PUBLISH is deliberate: to the website, or to the sales library only.
 *     It checks the trip is complete enough to sell first.
 *
 * Seats are not edited here except on the Departures tab, which goes through
 * the booking-safe path (#130).
 */

const STATUS_CLASSES = {
  draft: "bg-paper-line-strong text-paper-text-muted",
  internal: "bg-warn/20 text-warn",
  published: "bg-good/15 text-good",
  archived: "bg-paper-line text-paper-text-faint",
};

const label = "text-[12.5px] font-semibold text-paper-text-muted";
const input =
  "w-full rounded-xl border border-paper-line-strong bg-paper px-3 py-2.5 text-[14.5px] text-paper-text outline-none focus:border-accent disabled:opacity-60";

function Field({ title, hint, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={label}>{title}</span>
      {children}
      {hint && <span className="text-[11.5px] text-paper-text-faint">{hint}</span>}
    </label>
  );
}

/** One item per line — the quickest list editor on a phone keyboard. */
function LinesField({ title, hint, value, onChange, disabled, rows = 5 }) {
  return (
    <Field title={title} hint={hint ?? "One per line."}>
      <textarea
        rows={rows}
        disabled={disabled}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((l) => l.trimStart()))}
        onBlur={(e) => onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
        className={input}
      />
    </Field>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-paper-line bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-paper-text">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

const smallButton =
  "rounded-lg border border-paper-line-strong px-2.5 py-1.5 text-[12px] font-bold text-paper-text-muted hover:border-accent hover:text-accent-deep disabled:opacity-40";

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function OverviewTab({ kind, c, set, disabled }) {
  return (
    <>
      <Section title="The basics">
        <Field title="Title">
          <input className={input} disabled={disabled} value={c.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field title="Route" hint="Places in order, separated by · — e.g. Srinagar · Gulmarg · Pahalgam">
          <input className={input} disabled={disabled} value={c.destination} onChange={(e) => set({ destination: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field title="Region">
            <select className={input} disabled={disabled} value={c.region} onChange={(e) => set({ region: e.target.value })}>
              <option>India</option>
              <option>International</option>
            </select>
          </Field>
          <Field title="Theme" hint="Mountains, Beach, Culture…">
            <input className={input} disabled={disabled} value={c.theme} onChange={(e) => set({ theme: e.target.value })} />
          </Field>
          <Field title="Length" hint={kind === "group" ? "e.g. 6N / 7D" : "e.g. 5–7 days"}>
            <input className={input} disabled={disabled} value={c.duration} onChange={(e) => set({ duration: e.target.value })} />
          </Field>
        </div>
        <Field title="Why this trip" hint="One or two lines. Shown under the title and on cards.">
          <textarea rows={3} className={input} disabled={disabled} value={c.summary} onChange={(e) => set({ summary: e.target.value })} />
        </Field>
      </Section>

      {kind === "group" ? (
        <Section title="Group details">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field title="Group size" hint="e.g. 10–16 travellers">
              <input className={input} disabled={disabled} value={c.groupSize} onChange={(e) => set({ groupSize: e.target.value })} />
            </Field>
            <Field title="Age group" hint="e.g. 18–45">
              <input className={input} disabled={disabled} value={c.ageGroup} onChange={(e) => set({ ageGroup: e.target.value })} />
            </Field>
            <Field title="Advance per person (₹)">
              <input type="number" inputMode="numeric" min={0} className={input} disabled={disabled} value={c.advanceAmount} onChange={(e) => set({ advanceAmount: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <PricedList
            title="Room sharing"
            hint="Added per person to the departure price."
            items={c.sharing}
            nameKey="label"
            namePlaceholder="Double sharing"
            onChange={(sharing) => set({ sharing })}
            disabled={disabled}
          />
          <PricedList
            title="Joining points"
            hint="Where travellers can join, and what it adds per person."
            items={c.pickups}
            nameKey="city"
            namePlaceholder="Delhi"
            onChange={(pickups) => set({ pickups })}
            disabled={disabled}
          />
        </Section>
      ) : (
        <Section title="Customized trip details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field title="From price per person (₹)">
              <input type="number" inputMode="numeric" min={0} className={input} disabled={disabled} value={c.fromPrice} onChange={(e) => set({ fromPrice: Number(e.target.value) || 0 })} />
            </Field>
            <Field title="Best time to go" hint="e.g. October to March">
              <input className={input} disabled={disabled} value={c.bestTime} onChange={(e) => set({ bestTime: e.target.value })} />
            </Field>
          </div>
          <Field title="Ideal for" hint="Comma separated — Honeymoon, Family, Parents…">
            <input
              className={input}
              disabled={disabled}
              value={c.idealFor.join(", ")}
              onChange={(e) => set({ idealFor: e.target.value.split(",").map((s) => s.trimStart()) })}
              onBlur={(e) => set({ idealFor: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
        </Section>
      )}
    </>
  );
}

function PricedList({ title, hint, items, nameKey, namePlaceholder, onChange, disabled }) {
  const patch = (i, p) => onChange(items.map((it, j) => (j === i ? { ...it, ...p } : it)));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={label}>{title}</span>
        <button
          type="button"
          disabled={disabled}
          className={smallButton}
          onClick={() => onChange([...items, { id: `opt-${Date.now().toString(36)}`, [nameKey]: "", detail: "", delta: 0 }])}
        >
          + Add
        </button>
      </div>
      <p className="text-[11.5px] text-paper-text-faint">{hint}</p>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={it.id} className="grid grid-cols-[1fr_1fr_90px_auto] items-center gap-2">
            <input aria-label="Name" placeholder={namePlaceholder} className={input} disabled={disabled} value={it[nameKey] ?? ""} onChange={(e) => patch(i, { [nameKey]: e.target.value })} />
            <input aria-label="Detail" placeholder="Short detail" className={input} disabled={disabled} value={it.detail ?? ""} onChange={(e) => patch(i, { detail: e.target.value })} />
            <input aria-label="Adds (₹)" type="number" inputMode="numeric" min={0} className={input} disabled={disabled} value={it.delta} onChange={(e) => patch(i, { delta: Number(e.target.value) || 0 })} />
            <button type="button" disabled={disabled} aria-label="Remove" className={smallButton} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-[12.5px] text-paper-text-faint">None yet.</p>}
      </div>
    </div>
  );
}

function ItineraryTab({ c, set, disabled }) {
  const days = c.days;
  const update = (next) => set({ days: next });
  const patch = (i, p) => update(days.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const move = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= days.length) return;
    const next = [...days];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const add = () => update([...days, { day: String(days.length + 1), title: "", detail: "" }]);

  return (
    <Section
      title={`Day by day (${days.length})`}
      action={
        <button type="button" disabled={disabled} className={smallButton} onClick={add}>
          + Add day
        </button>
      }
    >
      {days.length === 0 && (
        <p className="rounded-xl border border-dashed border-paper-line-strong p-5 text-center text-[13px] text-paper-text-muted">
          No days yet. A trip cannot go live without its itinerary — add the first day.
        </p>
      )}
      {days.map((d, i) => (
        <div key={i} className="rounded-xl border border-paper-line p-3">
          <div className="grid grid-cols-[70px_1fr] gap-2">
            <Field title="Day">
              <input className={input} disabled={disabled} value={d.day} onChange={(e) => patch(i, { day: e.target.value })} />
            </Field>
            <Field title="Title">
              <input className={input} disabled={disabled} value={d.title} placeholder="Arrive Srinagar" onChange={(e) => patch(i, { title: e.target.value })} />
            </Field>
          </div>
          <div className="mt-2">
            <Field title="What happens">
              <textarea rows={3} className={input} disabled={disabled} value={d.detail} onChange={(e) => patch(i, { detail: e.target.value })} />
            </Field>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" disabled={disabled || i === 0} className={smallButton} onClick={() => move(i, -1)}>↑ Up</button>
            <button type="button" disabled={disabled || i === days.length - 1} className={smallButton} onClick={() => move(i, 1)}>↓ Down</button>
            <button type="button" disabled={disabled} className={smallButton} onClick={() => update([...days.slice(0, i + 1), { ...d }, ...days.slice(i + 1)])}>Duplicate</button>
            <button type="button" disabled={disabled} className={`${smallButton} ml-auto`} onClick={() => update(days.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </div>
      ))}
      {days.length > 0 && (
        <button type="button" disabled={disabled} className={smallButton} onClick={add}>
          + Add day {days.length + 1}
        </button>
      )}
    </Section>
  );
}

function DetailsTab({ kind, c, set, disabled }) {
  const faq = c.faq;
  return (
    <>
      <Section title="What's in the price">
        <LinesField title="Included" value={c.inclusions} onChange={(inclusions) => set({ inclusions })} disabled={disabled} />
        <LinesField title="Not included" value={c.exclusions} onChange={(exclusions) => set({ exclusions })} disabled={disabled} />
      </Section>
      <Section title="Selling points">
        <LinesField title="Highlights" value={c.highlights} onChange={(highlights) => set({ highlights })} disabled={disabled} rows={4} />
        <LinesField title="Know before you go" value={c.knowBefore} onChange={(knowBefore) => set({ knowBefore })} disabled={disabled} rows={4} />
        {kind === "customized" && (
          <LinesField title="Places covered" value={c.places} onChange={(places) => set({ places })} disabled={disabled} rows={4} />
        )}
      </Section>
      <Section
        title={`Questions people ask (${faq.length})`}
        action={
          <button type="button" disabled={disabled} className={smallButton} onClick={() => set({ faq: [...faq, { q: "", a: "" }] })}>
            + Add question
          </button>
        }
      >
        {faq.length === 0 && <p className="text-[12.5px] text-paper-text-faint">No questions yet.</p>}
        {faq.map((item, i) => (
          <div key={i} className="rounded-xl border border-paper-line p-3">
            <Field title="Question">
              <input className={input} disabled={disabled} value={item.q} onChange={(e) => set({ faq: faq.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)) })} />
            </Field>
            <div className="mt-2">
              <Field title="Answer">
                <textarea rows={3} className={input} disabled={disabled} value={item.a} onChange={(e) => set({ faq: faq.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)) })} />
              </Field>
            </div>
            <button type="button" disabled={disabled} className={`${smallButton} mt-2`} onClick={() => set({ faq: faq.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        ))}
      </Section>
    </>
  );
}

function PhotoTab({ c, set, photos, slug, disabled }) {
  const [query, setQuery] = useState("");
  const chosen = c.coverImageId ?? (photos.some((p) => p.id === slug) ? slug : null);
  const needle = query.trim().toLowerCase();
  const shown = photos.filter((p) => !needle || `${p.title} ${p.id}`.toLowerCase().includes(needle));
  return (
    <Section title="Cover photo">
      <p className="text-[12.5px] text-paper-text-muted">
        Used on the trip page and every card. Pick one that reads as the place at a glance, ideally
        with travellers in it. Uploading new photos comes in the next phase.
      </p>
      <input type="search" placeholder="Search photos…" value={query} onChange={(e) => setQuery(e.target.value)} className={input} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => set({ coverImageId: p.id })}
            aria-pressed={chosen === p.id}
            className={`group relative aspect-[4/3] overflow-hidden rounded-xl border-2 ${
              chosen === p.id ? "border-accent" : "border-transparent"
            }`}
            title={p.title}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- admin picker thumbnail */}
            <img src={p.src} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
            {chosen === p.id && (
              <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                <CheckIcon size={12} />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-ink/60 px-1.5 py-0.5 text-left text-[10.5px] text-white">
              {p.title}
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function HistoryTab({ trip }) {
  return (
    <Section title="Published versions">
      {trip.versions.length === 0 ? (
        <p className="text-[12.5px] text-paper-text-muted">
          {trip.fromCode && !trip.managed
            ? "This trip still renders from the original catalogue. Its first publish here becomes version 1."
            : "Not published yet."}
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {trip.versions.map((v) => (
            <li key={v.version} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-paper-dim px-3 py-2 text-[13px]">
              <span className="font-bold text-paper-text">v{v.version}</span>
              <span className="text-paper-text-muted">
                {v.status === "internal" ? "to sales only" : "to the website"} ·{" "}
                {v.publishedAt ? new Date(v.publishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
                {v.publishedByName ? ` · ${v.publishedByName}` : ""} · {v.days} days
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11.5px] text-paper-text-faint">
        Every publish is kept, so what a customer was sold can always be traced.
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// The studio
// ---------------------------------------------------------------------------

export default function TripStudio({ trip, departureTrip, photos, redirectOptions, canWrite }) {
  const router = useRouter();
  const [content, setContent] = useState(trip.content);
  const [saved, setSaved] = useState(trip.content);
  const [hasDraft, setHasDraft] = useState(trip.hasDraft);
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [redirectTo, setRedirectTo] = useState(redirectOptions[0]?.value ?? "");

  const archived = trip.status === "archived";
  const readOnly = !canWrite || archived;
  const dirty = useMemo(() => JSON.stringify(content) !== JSON.stringify(saved), [content, saved]);
  const problems = publishProblems(trip.kind, content);
  const status = TRIP_STATUSES.find((s) => s.value === trip.status);

  const set = (patch) => setContent((prev) => ({ ...prev, ...patch }));

  async function call(action, extra = {}, okMessage) {
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/trips/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, slug: trip.slug, ...extra }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice({ kind: "error", message: data.message });
        return null;
      }
      if (okMessage) setNotice({ kind: "ok", message: okMessage });
      return data;
    } catch {
      setNotice({ kind: "error", message: "Couldn't reach the server. Nothing was changed." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const data = await call("save", { content }, "Draft saved. The website has not changed.");
    if (data) {
      setSaved(content);
      setHasDraft(true);
    }
    return data;
  }

  async function publish(target) {
    // Save first, so what gets published is exactly what is on screen.
    if (dirty && !(await save())) return;
    const data = await call(
      "publish",
      { target },
      target === "published" ? "Published — live on the website now." : "Published to the sales library only."
    );
    if (data) {
      setHasDraft(false);
      router.refresh();
    }
  }

  async function act(action, extra, okMessage, after) {
    const data = await call(action, extra, okMessage);
    if (data) after?.(data);
  }

  const tabs = [
    ["overview", "Overview"],
    ["itinerary", `Itinerary (${content.days.length})`],
    ["details", "Inclusions & FAQ"],
    ["photo", "Photo"],
    ...(trip.kind === "group" ? [["departures", "Departures"]] : []),
    ["history", "History"],
  ];

  return (
    <div className="pb-4">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${STATUS_CLASSES[trip.status]}`}>
            {status?.label}
          </span>
          <span className="font-mono text-[10px] uppercase text-paper-text-faint">
            {trip.kind === "group" ? "Group tour" : "Customized trip"} · v{trip.version}
          </span>
          {hasDraft && !archived && (
            <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-deep">
              Unpublished changes
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-[26px] font-bold leading-tight tracking-tight text-paper-text">
          {content.title || "Untitled trip"}
        </h1>
        <p className="mt-1 text-[13px] text-paper-text-muted">
          {trip.status === "published" ? (
            <Link href={trip.path} target="_blank" className="font-semibold text-accent-deep underline-offset-2 hover:underline">
              View the live page ↗
            </Link>
          ) : trip.status === "internal" ? (
            "Visible to the sales team only — not on the website."
          ) : archived ? (
            `Archived${trip.redirectTo ? ` — its old link forwards to ${trip.redirectTo}` : " — its old link shows not found"}.`
          ) : (
            "Draft — only the team can see this."
          )}
        </p>
      </header>

      {archived && (
        <div className="mb-4 rounded-2xl border border-paper-line-strong bg-paper-dim p-4 text-[13px] text-paper-text-muted">
          Archived trips are read-only. Restore it to edit — it comes back as sales-only, so it does not
          reappear on the website by surprise.
        </div>
      )}

      <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Trip sections">
        {tabs.map(([key, name]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
              tab === key ? "bg-ink text-ink-text" : "bg-paper-dim text-paper-text-muted"
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-4">
        {tab === "overview" && <OverviewTab kind={trip.kind} c={content} set={set} disabled={readOnly} />}
        {tab === "itinerary" && <ItineraryTab c={content} set={set} disabled={readOnly} />}
        {tab === "details" && <DetailsTab kind={trip.kind} c={content} set={set} disabled={readOnly} />}
        {tab === "photo" && <PhotoTab c={content} set={set} photos={photos} slug={trip.slug} disabled={readOnly} />}
        {tab === "departures" &&
          (departureTrip ? (
            <section className="overflow-hidden rounded-2xl border border-paper-line bg-card">
              <p className="px-4 pt-4 text-[12.5px] text-paper-text-muted">
                Dates, prices and batch sizes save immediately and are live straight away — they
                do not wait for Publish. Seats left are worked out from bookings and holds.
              </p>
              {canWrite ? (
                <TripPanel
                  // Remount on fresh server data, so seats left and status
                  // shown after a save are the server's, not this form's.
                  key={departureTrip.departures.map((d) => `${d.id}:${d.capacity}:${d.seatsLeft}:${d.status}`).join("|")}
                  trip={departureTrip}
                  departuresOnly
                  onSaved={() => router.refresh()}
                />
              ) : (
                <p className="p-4 text-[13px] text-paper-text-muted">You can view departures but not change them.</p>
              )}
            </section>
          ) : (
            <Section title="Departures">
              <p className="text-[13px] text-paper-text-muted">
                Publish this trip once — to the website or to sales only — and you can add its
                departure dates and seats here.
              </p>
            </Section>
          ))}
        {tab === "history" && <HistoryTab trip={trip} />}
      </div>

      {/* The action bar sits in the thumb zone on a phone. */}
      {canWrite && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 mt-5 rounded-2xl border border-paper-line-strong bg-paper/95 p-3 shadow-xl shadow-ink/10 backdrop-blur lg:bottom-4">
          <div className="flex flex-col gap-2">
            {notice && (
              <p className={`flex items-start gap-1.5 text-[12.5px] font-semibold ${notice.kind === "ok" ? "text-good" : "text-danger"}`}>
                {notice.kind === "ok" ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
                {notice.message}
              </p>
            )}

            {archived ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => act("restore", {}, "Restored as sales-only.", () => router.refresh())}
                className="rounded-xl bg-ink px-5 py-3 text-[14px] font-bold text-ink-text disabled:opacity-50"
              >
                {busy === "restore" ? "Restoring…" : "Restore trip"}
              </button>
            ) : archiving ? (
              <div className="flex flex-col gap-2 rounded-xl border border-paper-line-strong bg-card p-3">
                <p className="text-[13px] font-bold text-paper-text">Archive “{content.title}”?</p>
                <p className="text-[12.5px] text-paper-text-muted">
                  It leaves the website and the sales library. Its history stays. Where should its old
                  link send people?
                </p>
                <select className={input} value={redirectTo} onChange={(e) => setRedirectTo(e.target.value)}>
                  {redirectOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  <option value="">Nowhere — show “not found”</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      act("archive", { redirectTo: redirectTo || null }, "Archived.", () => {
                        setArchiving(false);
                        router.refresh();
                      })
                    }
                    className="flex-1 rounded-xl bg-danger px-4 py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
                  >
                    {busy === "archive" ? "Archiving…" : "Archive"}
                  </button>
                  <button type="button" onClick={() => setArchiving(false)} className="rounded-xl border border-paper-line-strong px-4 py-3 text-[13.5px] font-semibold text-paper-text-muted">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {problems.length > 0 && (
                  <p className="text-[12px] text-warn">
                    Before it can go live: {problems.join(" ")}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busy) || !dirty}
                    onClick={save}
                    className="flex-1 rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[14px] font-bold text-paper-text disabled:opacity-40"
                  >
                    {busy === "save" ? "Saving…" : dirty ? "Save draft" : "Saved"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy) || problems.length > 0 || (!dirty && !hasDraft && trip.status === "published")}
                    onClick={() => publish("published")}
                    className="flex-1 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white disabled:opacity-40"
                  >
                    {busy === "publish" ? "Publishing…" : "Publish to website"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-semibold">
                  <button type="button" disabled={Boolean(busy)} onClick={() => publish("internal")} className="text-paper-text-muted hover:text-paper-text">
                    Publish to sales only
                  </button>
                  {hasDraft && trip.everPublished && (
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => act("discard", {}, "Changes discarded.", () => router.refresh())}
                      className="text-paper-text-muted hover:text-paper-text"
                    >
                      Discard changes
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => act("duplicate", {}, null, (data) => router.push(`/admin/trips/${data.trip.slug}`))}
                    className="text-paper-text-muted hover:text-paper-text"
                  >
                    Duplicate
                  </button>
                  {trip.everPublished ? (
                    <button type="button" onClick={() => setArchiving(true)} className="text-danger">
                      Archive…
                    </button>
                  ) : deleting ? (
                    // Confirmed in place, never with a browser dialog
                    // (DESIGN-SYSTEM.md, Forms).
                    <span className="flex items-center gap-2">
                      <span className="text-paper-text-muted">Delete this draft for good?</span>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => act("delete", {}, null, () => router.push("/admin/trips"))}
                        className="text-danger underline"
                      >
                        {busy === "delete" ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button type="button" onClick={() => setDeleting(false)} className="text-paper-text-muted">
                        Keep it
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setDeleting(true)} className="text-danger">
                      Delete draft
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
