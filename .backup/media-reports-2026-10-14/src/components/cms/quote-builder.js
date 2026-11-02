"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  seatedTravellers,
  normaliseBrief,
  briefGaps,
  travellerSummary,
  hotelCategoryLabel,
  mealPlanLabel,
  roomClassLabel,
  occupancyLabel,
  transportLabel,
} from "@/lib/crm/brief";
import { QUOTE_LINE_KINDS, money } from "@/lib/crm/schema";
import { AlertIcon, CheckIcon, SparkleIcon, ChevronIcon } from "@/components/icons";

/**
 * The quotation builder.
 *
 * The slow part of quoting was never typing — it is deciding what goes in, at
 * what price, and writing inclusions precise enough that nobody rings back
 * asking whether flights are covered. "Draft with AI" fills all of that from
 * the enquiry; the salesperson then corrects it.
 *
 * Two decisions make that safe rather than reckless:
 *
 *   EVERY TOTAL IS COMPUTED HERE AND AGAIN ON THE SERVER. The client never
 *   posts a total. A figure nobody can reproduce from the lines is the first
 *   thing to go wrong when someone edits a row and forgets the sum.
 *
 *   CONFIDENCE IS VISIBLE. A line the model guessed is marked, and the ones
 *   that need checking are the ones that look like they need checking. An AI
 *   draft that presents invented hotel rates as settled fact is worse than a
 *   blank form.
 */

const field =
  "w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent";
const label = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";

const CONFIDENCE = {
  known: { label: "", className: "" },
  estimate: { label: "estimate", className: "bg-warn/20 text-warn" },
  placeholder: { label: "check this", className: "bg-danger/15 text-danger" },
};

const emptyLine = () => ({
  kind: "other",
  label: "",
  detail: "",
  quantity: 1,
  unitPrice: 0,
  perPerson: false,
  unitCost: 0,
  confidence: "known",
});

/** Mirrors priceQuotation() on the server, so the screen and the record agree. */
function price(lines, travellers, discount, taxPercent) {
  const heads = Math.max(1, Number(travellers) || 1);
  const priced = lines.map((line) => {
    const unit = Math.max(0, Number(line.unitPrice) || 0);
    const cost = Math.max(0, Number(line.unitCost) || 0);
    const qty = Math.max(1, Number(line.quantity) || 1);
    const multiplier = line.perPerson ? qty * heads : qty;
    return { ...line, amount: unit * multiplier, costAmount: cost * multiplier };
  });
  const subtotal = priced.reduce((sum, l) => sum + l.amount, 0);
  const cost = priced.reduce((sum, l) => sum + l.costAmount, 0);
  const discountValue = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const taxable = subtotal - discountValue;
  const tax = Math.round((taxable * (Number(taxPercent) || 0)) / 100);
  const total = taxable + tax;
  // Margin on the pre-tax figure: GST is collected for the government, not
  // earned. Counting it as revenue flatters every deal.
  const hasCost = cost > 0;
  const grossMargin = hasCost ? taxable - cost : null;
  return {
    priced,
    subtotal,
    cost,
    discountValue,
    tax,
    total,
    grossMargin,
    marginPercent: hasCost && taxable > 0 ? Math.round((grossMargin / taxable) * 100) : null,
    perPerson: Math.round(total / heads),
  };
}

function LineRow({ line, index, onChange, onRemove }) {
  const meta = CONFIDENCE[line.confidence] ?? CONFIDENCE.known;

  return (
    <div className="rounded-xl border border-paper-line bg-card p-3">
      <div className="flex items-start gap-2">
        <input
          value={line.label}
          onChange={(e) => onChange(index, { label: e.target.value })}
          placeholder="What is this?"
          className="min-w-0 flex-1 rounded-lg border border-paper-line-strong bg-paper px-2.5 py-1.5 text-[13.5px] font-semibold outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="Remove line"
          className="shrink-0 rounded-lg px-2 py-1.5 text-[16px] font-bold text-paper-text-faint hover:text-danger"
        >
          ×
        </button>
      </div>

      {meta.label && (
        <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${meta.className}`}>
          {meta.label}
        </span>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className={label}>Type</span>
          <select
            value={line.kind}
            onChange={(e) => onChange(index, { kind: e.target.value })}
            className={field}
          >
            {QUOTE_LINE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Qty</span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={line.quantity}
            onChange={(e) => onChange(index, { quantity: Number(e.target.value) || 1 })}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Sell ₹</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={line.unitPrice}
            onChange={(e) => onChange(index, { unitPrice: Number(e.target.value) || 0 })}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          {/* What we pay the supplier. Without it a discount is guesswork. */}
          <span className={label}>Cost ₹</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={line.unitCost ?? 0}
            onChange={(e) => onChange(index, { unitCost: Number(e.target.value) || 0 })}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Charged</span>
          {/* The distinction that ruins quotations when it is wrong: a per-head
              cost multiplied by the group versus a group cost charged once. */}
          <button
            type="button"
            onClick={() => onChange(index, { perPerson: !line.perPerson })}
            className={`rounded-lg border px-2 py-2 text-[12px] font-bold transition-all ${
              line.perPerson
                ? "border-accent bg-accent text-white"
                : "border-paper-line-strong text-paper-text-muted"
            }`}
          >
            {line.perPerson ? "per person" : "per group"}
          </button>
        </label>
      </div>
    </div>
  );
}

function Chips({ items, onChange, placeholder }) {
  const [value, setValue] = useState("");

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-1.5 rounded-lg bg-paper-dim px-2.5 py-1.5 text-[12.5px] text-paper-text"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, index) => index !== i))}
              className="font-bold text-paper-text-faint hover:text-danger"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          onChange([...items, value.trim()]);
          setValue("");
        }}
        className="mt-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={field}
        />
      </form>
    </div>
  );
}


/**
 * What the salesperson already confirmed, restated above the pricing.
 *
 * Read-only on purpose: the brief is edited on the lead, and two places to
 * change one fact is how they end up disagreeing. This is a reminder, not a
 * second form — but it links back, because the commonest reason to want it is
 * that something was missed.
 *
 * Shows gaps as loudly as facts. Pricing a trip without knowing the meal plan
 * is the specific mistake this whole feature exists to prevent, and finding
 * out after the quotation has gone is too late.
 */
function BriefRecap({ lead }) {
  const brief = normaliseBrief(lead.brief);
  const gaps = briefGaps(lead);
  const pax = travellerSummary(lead);

  const facts = [
    lead.departureDate
      ? `${lead.departureDate}${lead.departureFlexible ? " (flexible)" : ""}`
      : null,
    pax || null,
    brief.hotelCategory ? hotelCategoryLabel(brief.hotelCategory) : null,
    brief.mealPlan ? mealPlanLabel(brief.mealPlan) : null,
    brief.rooms?.length
      ? brief.rooms
          .map(
            (r) =>
              `${r.count} × ${roomClassLabel(r.roomClass)} ${occupancyLabel(r.occupancy)}` +
              (r.extraMattress ? ` +${r.extraMattress} mattress` : "")
          )
          .join(", ")
      : null,
    brief.transportModes?.length ? brief.transportModes.map(transportLabel).join(" + ") : null,
    lead.budgetAmount
      ? `Budget ₹${Number(lead.budgetAmount).toLocaleString("en-IN")} ${
          lead.budgetPerPerson === false ? "total" : "pp"
        }`
      : null,
  ].filter(Boolean);

  if (facts.length === 0 && gaps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-paper-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
          What {lead.name} asked for
        </p>
        <Link
          href={`/admin/leads/${lead.id}`}
          className="text-[12px] font-bold text-accent-deep underline"
        >
          Edit the brief
        </Link>
      </div>

      {facts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {facts.map((fact) => (
            <span
              key={fact}
              className="rounded-full bg-ink/6 px-2.5 py-1 text-[12.5px] text-paper-text"
            >
              {fact}
            </span>
          ))}
        </div>
      )}

      {brief.specialRequests?.trim() ? (
        <p className="mt-2 text-[12.5px] text-paper-text-muted">
          Special requests — {brief.specialRequests.trim()}
        </p>
      ) : null}

      {gaps.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] text-paper-text-muted">
          <AlertIcon size={13} className="mt-0.5 shrink-0" />
          Not confirmed yet: <span className="text-paper-text">{gaps.join(", ")}</span>. The price
          below assumes them.
        </p>
      )}
    </div>
  );
}

export default function QuoteBuilder({ lead, existing, autoDraft = false }) {
  const [form, setForm] = useState(() => ({
    title: existing?.title ?? `${lead.destination ?? "Custom trip"} — proposal`,
    summary: existing?.summary ?? "",
    destination: existing?.destination ?? lead.destination ?? "",
    durationDays: existing?.durationDays ?? null,
    // The brief's head count beats `groupSize`: it is what the salesperson
    // confirmed on the call, and it knows the difference between an adult
    // and a four-year-old. Infants are excluded — they are not a priced head.
    // `||`, not `??`: an empty brief counts 0 seated travellers, and 0 is not
    // null — so a lead that said "2 travellers" opened at 0, every per-person
    // line priced at nothing, and the draft showed ₹42,473 instead of ₹64,155
    // (review 2026-10-14-full-function-test, F4).
    travellers: existing?.travellers || seatedTravellers(lead) || lead.groupSize || 2,
    discount: existing?.discount ?? 0,
    taxPercent: existing?.taxPercent ?? 5,
    lines: existing?.lines ?? [emptyLine()],
    inclusions: existing?.inclusions ?? [],
    exclusions: existing?.exclusions ?? [],
    terms: existing?.terms ?? "",
  }));

  const [quotationId, setQuotationId] = useState(existing?.id ?? null);
  const [status, setStatus] = useState(existing?.status ?? null);
  const [assumptions, setAssumptions] = useState([]);
  const [grounding, setGrounding] = useState(null);
  const [question, setQuestion] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  const totals = useMemo(
    () => price(form.lines, form.travellers, form.discount, form.taxPercent),
    [form.lines, form.travellers, form.discount, form.taxPercent]
  );

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  function changeLine(index, patch) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  }

  async function draftWithAI() {
    setDrafting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/quotations/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      const d = data.draft;
      set({
        title: d.title,
        summary: d.summary,
        durationDays: d.durationDays,
        lines: d.lines.map((l) => ({ ...l, detail: l.detail ?? "" })),
        inclusions: d.inclusions,
        exclusions: d.exclusions,
      });
      setAssumptions(d.assumptions ?? []);
      setGrounding(data.grounding ?? null);
      setQuestion(d.clarifyingQuestion ?? null);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setDrafting(false);
    }
  }

  /**
   * Arriving from "Draft quotation" on the lead goes straight into the draft.
   *
   * The two-minute target cannot survive a landing page: the salesperson has
   * already decided they want a quotation, and making them find a second
   * button is a step that buys nothing. Guarded by a ref rather than the
   * `drafting` flag because React runs effects twice in development and the
   * draft costs a model call.
   */
  const autoDrafted = useRef(false);
  useEffect(() => {
    if (!autoDraft || existing || autoDrafted.current) return;
    autoDrafted.current = true;
    draftWithAI();
    // draftWithAI is stable for the life of this component and re-running on
    // its identity would fire a second paid call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDraft, existing]);

  async function save(action = "save") {
    setBusy(true);
    setError(null);
    setSaved(null);

    const draft = {
      ...form,
      durationDays: form.durationDays ?? null,
      travellers: Number(form.travellers) || 1,
      discount: Number(form.discount) || 0,
      taxPercent: Number(form.taxPercent) || 0,
      terms: form.terms || null,
    };

    try {
      const response = quotationId
        ? await fetch("/api/admin/quotations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: quotationId, action, draft }),
          })
        : await fetch("/api/admin/quotations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: lead.id, draft }),
          });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }

      // The address bar follows the record. It stayed on /quotations/new after
      // the first save, so a reload or a shared link opened a blank builder
      // (F14). replaceState, not router.replace: remounting would throw away
      // the AI's assumptions and question, which are not stored.
      if (!quotationId && typeof window !== "undefined") {
        window.history.replaceState(null, "", `/admin/quotations/${data.quotation.id}`);
      }
      setQuotationId(data.quotation.id);
      setStatus(data.quotation.status);
      setSaved(
        action === "send"
          ? "Sent. The customer has the link."
          : `Saved as version ${data.quotation.version}.`
      );
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!quotationId) {
      await save("save");
      return;
    }
    await save("send");
  }

  const sent = status && status !== "draft";

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* The brief, restated where the quoting happens.
          It was only on the lead page, so a salesperson pricing a trip had to
          keep another tab open to remember the hotel standard they agreed and
          whether a seven-year-old was travelling. Both change the price. */}
      <BriefRecap lead={lead} />

      {/* AI draft — the two-minute promise */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[14px] font-bold text-paper-text">
              <SparkleIcon size={15} className="text-accent-deep" /> Draft from the enquiry
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
              Fills the lines, inclusions and exclusions from what {lead.name} told us
              {lead.itinerary ? ", including the itinerary they saw" : ""}. Check every price
              before sending.
            </p>
          </div>
          <button
            type="button"
            onClick={draftWithAI}
            disabled={drafting || sent}
            className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {drafting ? "Drafting…" : "Draft with AI"}
          </button>
        </div>

        {grounding && (
          <p className="mt-2.5 font-mono text-[10.5px] text-paper-text-muted">
            {grounding.anchored
              ? `Priced against: ${grounding.comparedWith.join(", ")}`
              : "No comparable trip in the catalogue — check every figure."}
            {grounding.season ? ` · ${grounding.season}` : ""}
          </p>
        )}

        {question && (
          <div className="mt-3 rounded-xl border border-accent/40 bg-paper p-3">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
              Ask them this
            </p>
            <p className="mt-1 text-[13px] leading-snug text-paper-text">{question}</p>
          </div>
        )}

        {assumptions.length > 0 && (
          <div className="mt-3 rounded-xl bg-paper p-3">
            <p className={label}>What it assumed</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {assumptions.map((a) => (
                <li key={a} className="text-[12.5px] leading-snug text-paper-text-muted">
                  · {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {sent && (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
          <p className="text-[13px] font-bold text-paper-text">
            This quotation is with the customer
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
            Sent quotations are frozen so the price they approve is the price they saw. Create a
            revision to change anything.
          </p>
        </div>
      )}

      {/* Header fields */}
      <div className="rounded-2xl border border-paper-line bg-card p-4">
        <label className="flex flex-col gap-1">
          <span className={label}>Title</span>
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={field} />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className={label}>The pitch the customer reads first</span>
          <textarea
            value={form.summary}
            onChange={(e) => set({ summary: e.target.value })}
            rows={3}
            className={`${field} resize-y`}
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className={label}>Travellers</span>
            <input
              type="number"
              min="1"
              value={form.travellers}
              onChange={(e) => set({ travellers: Number(e.target.value) || 1 })}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            {/* The field is `durationDays` and the customer page prints it
                as DAYS. It was labelled "Nights", so a 6N/7D trip correctly
                drafted as 7 looked wrong and got "fixed" to 6. */}
            <span className={label}>Days</span>
            <input
              type="number"
              min="1"
              value={form.durationDays ?? ""}
              onChange={(e) => set({ durationDays: Number(e.target.value) || null })}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>Discount ₹</span>
            <input
              type="number"
              min="0"
              value={form.discount}
              onChange={(e) => set({ discount: Number(e.target.value) || 0 })}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={label}>GST %</span>
            <input
              type="number"
              min="0"
              max="40"
              value={form.taxPercent}
              onChange={(e) => set({ taxPercent: Number(e.target.value) || 0 })}
              className={field}
            />
          </label>
        </div>
      </div>

      {/* Lines */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className={label}>What it is made of</h2>
          <button
            type="button"
            onClick={() => set({ lines: [...form.lines, emptyLine()] })}
            className="text-[12.5px] font-bold text-accent-deep"
          >
            + Add line
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {form.lines.map((line, index) => (
            <LineRow
              key={index}
              line={line}
              index={index}
              onChange={changeLine}
              onRemove={(i) => set({ lines: form.lines.filter((_, x) => x !== i) })}
            />
          ))}
        </div>
      </section>

      {/* Totals */}
      <div className="sticky bottom-20 rounded-2xl border border-paper-line-strong bg-card p-4 shadow-lg shadow-ink/5 lg:bottom-4">
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-paper-text-muted">Subtotal</dt>
            <dd className="font-semibold text-paper-text">{money(totals.subtotal)}</dd>
          </div>
          {totals.discountValue > 0 && (
            <div className="flex justify-between">
              <dt className="text-paper-text-muted">Discount</dt>
              <dd className="font-semibold text-good">− {money(totals.discountValue)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-paper-text-muted">GST {form.taxPercent}%</dt>
            <dd className="font-semibold text-paper-text">{money(totals.tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-paper-line pt-2">
            <dt className="font-bold text-paper-text">Total</dt>
            <dd className="font-display text-[19px] font-bold text-accent-deep">
              {money(totals.total)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-paper-text-faint">Per person × {form.travellers}</dt>
            <dd className="text-paper-text-muted">{money(totals.perPerson)}</dd>
          </div>
          {totals.cost > 0 && (
            <div className="mt-1 flex justify-between border-t border-paper-line pt-2">
              <dt className="text-paper-text-faint">
                Margin
                <span className="ml-1.5 font-mono text-[10.5px]">
                  (cost {money(totals.cost)})
                </span>
              </dt>
              {/* 12% is roughly where an Indian package stops being worth
                  running once the desk's own time is counted. */}
              <dd
                className={`font-semibold ${
                  totals.marginPercent >= 15
                    ? "text-good"
                    : totals.marginPercent >= 8
                      ? "text-warn"
                      : "text-danger"
                }`}
              >
                {money(totals.grossMargin)} · {totals.marginPercent}%
              </dd>
            </div>
          )}
        </dl>

        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
            <AlertIcon size={13} /> {error}
          </p>
        )}
        {saved && (
          <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-good">
            <CheckIcon size={13} /> {saved}
          </p>
        )}

        {/* A sent quotation is frozen, so its Save and Send are not offered
            at all — two dead buttons read as "something is broken" (F14). */}
        {!sent && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => save("save")}
            disabled={busy || sent}
            className="flex-1 rounded-xl border border-paper-line-strong px-4 py-3 text-[13.5px] font-bold text-paper-text disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy || sent || !quotationId}
            className="flex-1 rounded-xl bg-accent px-4 py-3 text-[13.5px] font-bold text-white disabled:opacity-40"
          >
            Send to customer
          </button>
        </div>
        )}

        {quotationId && (
          <Link
            href={`/admin/quotations/${quotationId}`}
            className={`flex items-center justify-center gap-1 text-[12.5px] font-semibold text-accent-deep ${
              sent ? "mt-3 rounded-xl border border-accent/40 px-4 py-3" : "mt-2"
            }`}
          >
            {sent ? "Open this quotation — revise it or follow up" : "Open this quotation"}{" "}
            <ChevronIcon size={11} />
          </Link>
        )}
      </div>

      {/* Inclusions / exclusions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-paper-line bg-card p-4">
          <h2 className={label}>What is included</h2>
          <div className="mt-2">
            <Chips
              items={form.inclusions}
              onChange={(v) => set({ inclusions: v })}
              placeholder="Add an inclusion and press enter"
            />
          </div>
        </section>
        <section className="rounded-2xl border border-paper-line bg-card p-4">
          <h2 className={label}>What is not</h2>
          <div className="mt-2">
            <Chips
              items={form.exclusions}
              onChange={(v) => set({ exclusions: v })}
              placeholder="Add an exclusion and press enter"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
