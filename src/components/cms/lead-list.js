import Link from "next/link";
import { LEAD_STAGES, TONE_CLASSES, money } from "@/lib/crm/schema";
import { ChevronIcon } from "@/components/icons";

/**
 * The filtered list.
 *
 * A server component: it renders from props and has no interaction of its own,
 * so it costs nothing on the client. The filter bar above it is the only part
 * that needs to be interactive.
 */
function dueLabel(iso) {
  if (!iso) return { text: "no follow-up", tone: "warn" };
  const due = new Date(iso);
  const days = Math.round((due - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: "danger" };
  if (days === 0) return { text: "due today", tone: "accent" };
  if (days === 1) return { text: "tomorrow", tone: "neutral" };
  return {
    text: due.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    tone: "neutral",
  };
}

const TEXT = {
  danger: "text-danger",
  warn: "text-warn",
  accent: "text-accent-deep",
  neutral: "text-paper-text-muted",
};

export default function LeadList({ leads }) {
  if (leads.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-paper-line-strong p-10 text-center text-[13.5px] leading-relaxed text-paper-text-muted">
        Nothing matches those filters. Clear one and try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {leads.map((lead) => {
        const stage = LEAD_STAGES.find((s) => s.value === (lead.status ?? "new")) ?? LEAD_STAGES[0];
        const due = dueLabel(lead.followUpAt);

        return (
          <Link
            key={lead.id}
            href={`/admin/leads/${lead.id}`}
            className="flex items-start justify-between gap-3 rounded-2xl border border-paper-line bg-card px-4 py-3 transition-colors hover:border-accent/50"
          >
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
                {[lead.destination, lead.dates, lead.phone].filter(Boolean).join(" · ")}
              </p>
              <p className={`mt-0.5 font-mono text-[10.5px] font-bold ${TEXT[due.tone]}`}>
                {due.text}
                {lead.outstanding > 0 && (
                  <span className="ml-2 text-warn">{money(lead.outstanding)} due</span>
                )}
              </p>
            </div>
            <ChevronIcon size={13} className="mt-1 shrink-0 text-paper-text-faint" />
          </Link>
        );
      })}
    </div>
  );
}
