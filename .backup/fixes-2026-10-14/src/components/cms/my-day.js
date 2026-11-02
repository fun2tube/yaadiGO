"use client";

import { useState } from "react";
import Link from "next/link";
import { money, LEAD_STAGES, TONE_CLASSES } from "@/lib/crm/schema";
import { WhatsAppIcon, ChevronIcon, CheckIcon } from "@/components/icons";

/**
 * "My day" — what a salesperson opens the panel for.
 *
 * Every count is a tab, not a statistic. A number you cannot tap through to the
 * actual list is decoration, and decoration is what makes dashboards stop
 * getting opened.
 *
 * Order is deliberate: overdue first, in red. The lead ignored longest is the
 * one about to be lost to whoever called them back.
 */

const TABS = [
  { key: "overdue", label: "Overdue", tone: "danger" },
  { key: "today", label: "Today", tone: "accent" },
  { key: "untouched", label: "New", tone: "warn" },
  { key: "chase", label: "Chase", tone: "warn" },
  { key: "tomorrow", label: "Tomorrow", tone: "neutral" },
  { key: "awaitingMoney", label: "Unpaid", tone: "warn" },
];

function stageMeta(value) {
  return LEAD_STAGES.find((s) => s.value === value) ?? LEAD_STAGES[0];
}

function dueLabel(iso) {
  if (!iso) return "no date";
  const due = new Date(iso);
  const days = Math.round((due - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function LeadRow({ lead }) {
  const stage = stageMeta(lead.status ?? "new");
  const overdue = lead.followUpAt && new Date(lead.followUpAt) < new Date().setHours(0, 0, 0, 0);

  return (
    <article className="rounded-2xl border border-paper-line bg-card">
      <Link href={`/admin/leads/${lead.id}`} className="block px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14.5px] font-bold text-paper-text">{lead.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${TONE_CLASSES[stage.tone]}`}
              >
                {stage.label}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10.5px] text-paper-text-faint">
              {[lead.destination, lead.dates, lead.groupSize ? `${lead.groupSize} pax` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p
              className={`mt-0.5 font-mono text-[10.5px] font-bold ${
                overdue ? "text-danger" : "text-paper-text-muted"
              }`}
            >
              {dueLabel(lead.followUpAt)}
              {lead.outstanding > 0 && (
                <span className="ml-2 text-warn">{money(lead.outstanding)} due</span>
              )}
            </p>
          </div>
          <ChevronIcon size={13} className="mt-1 shrink-0 text-paper-text-faint" />
        </div>
      </Link>

      {/* Call and WhatsApp on the row itself. Opening a record to find a phone
          number is a tap nobody should have to make. */}
      {lead.phone && (
        <div className="flex gap-2 border-t border-paper-line px-4 py-2">
          <a
            href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
            className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-ink-text"
          >
            Call
          </a>
          <a
            href={`https://wa.me/${lead.phone.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[12px] font-bold text-white"
          >
            <WhatsAppIcon size={12} /> WhatsApp
          </a>
        </div>
      )}
    </article>
  );
}

function ChaseRow({ quote }) {
  const hard = quote.chaseState === "cold";
  return (
    <article className="rounded-2xl border border-paper-line bg-card">
      <Link href={`/admin/quotations/${quote.id}`} className="block px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14.5px] font-bold text-paper-text">
                {quote.leadName ?? quote.title}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${
                  hard ? TONE_CLASSES.danger : TONE_CLASSES.warn
                }`}
              >
                {hard ? "going cold" : "chase"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-paper-text-muted">{quote.title}</p>
            <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">
              {money(quote.total)} · sent {quote.ageDays}d ago ·{" "}
              {quote.remindersSent === 0
                ? "no reminder yet"
                : `${quote.remindersSent} reminder${quote.remindersSent === 1 ? "" : "s"} sent`}
            </p>
          </div>
          <ChevronIcon size={13} className="mt-1 shrink-0 text-paper-text-faint" />
        </div>
      </Link>

      {quote.leadPhone && (
        <div className="flex gap-2 border-t border-paper-line px-4 py-2">
          <a
            href={`tel:${quote.leadPhone.replace(/[^\d+]/g, "")}`}
            className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-ink-text"
          >
            Call
          </a>
          <a
            href={`https://wa.me/${quote.leadPhone.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[12px] font-bold text-white"
          >
            <WhatsAppIcon size={12} /> WhatsApp
          </a>
        </div>
      )}
    </article>
  );
}

export default function MyDay({ day, name }) {
  const firstWithWork = TABS.find((t) => day.counts[t.key] > 0)?.key ?? "today";
  const [tab, setTab] = useState(firstWithWork);

  const rows = day[tab] ?? [];
  const nothingAtAll = day.counts.open === 0;

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          {name ? `Morning, ${name.split(" ")[0]}` : "Today"}
        </h1>
        <p className="mt-1 text-[13.5px] text-paper-text-muted">
          {nothingAtAll
            ? "No open leads."
            : day.counts.overdue > 0
              ? `${day.counts.overdue} overdue, ${day.counts.today} due today.`
              : `${day.counts.today} due today, ${day.counts.tomorrow} tomorrow.`}
        </p>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
              tab === t.key
                ? "border-ink bg-ink text-ink-text"
                : "border-paper-line-strong bg-card text-paper-text-muted"
            }`}
          >
            {t.label}
            <span
              className={`rounded px-1 font-mono text-[10px] ${
                tab === t.key
                  ? "bg-ink-text/20"
                  : day.counts[t.key] > 0
                    ? TONE_CLASSES[t.tone]
                    : "opacity-50"
              }`}
            >
              {day.counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-paper-line-strong p-8 text-center">
            {/* "Nothing to do" and "nothing exists" are different states and a
                finished day should feel finished. */}
            <p className="flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-good">
              <CheckIcon size={14} /> Nothing {tab === "overdue" ? "overdue" : `in ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}`}.
            </p>
            {day.counts.open > 0 && (
              <p className="mt-1 text-[12.5px] text-paper-text-muted">
                {day.counts.open} open lead{day.counts.open === 1 ? "" : "s"} in total.
              </p>
            )}
          </div>
        ) : (
          rows.map((row) =>
            tab === "chase" ? (
              <ChaseRow key={row.id} quote={row} />
            ) : (
              <LeadRow key={row.id} lead={row} />
            )
          )
        )}
      </div>

      {day.counts.noFollowUp > 0 && (
        <Link
          href="/admin/leads?due=none"
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3"
        >
          <p className="text-[13px] leading-snug text-paper-text">
            <strong className="font-bold">{day.counts.noFollowUp}</strong> open lead
            {day.counts.noFollowUp === 1 ? " has" : "s have"} no next step.
          </p>
          <ChevronIcon size={13} className="shrink-0 text-accent-deep" />
        </Link>
      )}
    </>
  );
}
