"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LEAD_STAGES } from "@/lib/crm/schema";

/**
 * The filter bar.
 *
 * State lives in the QUERY STRING, not in the component. A salesperson filters
 * to "overdue, payment pending", opens a lead, presses back — and must land
 * exactly where they were. Component state loses that every time, and losing
 * it is most of what makes a list feel broken on a phone.
 *
 * It also means a filtered view is a link, so "look at these four" can be
 * pasted into a message.
 */

const DUE = [
  { value: "any", label: "Any time" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "week", label: "This week" },
  { value: "none", label: "No date set" },
];

const MONEY = [
  { value: "any", label: "Any" },
  { value: "pending", label: "Payment pending" },
  { value: "paid", label: "Paid" },
  { value: "none", label: "No booking" },
];

function Row({ label, options, active, onPick }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[52px] shrink-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
        {label}
      </span>
      <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onPick(option.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
              active === option.value
                ? "border-ink bg-ink text-ink-text"
                : "border-paper-line-strong bg-card text-paper-text-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LeadFilters({ shown, total, canSeeEveryone, staff = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key, value) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "any") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const stage = params.get("stage") ?? "any";
  const due = params.get("due") ?? "any";
  const money = params.get("money") ?? "any";
  const owner = params.get("owner") ?? "any";
  const search = params.get("q") ?? "";

  const filtered = shown !== total;

  return (
    <div className="flex flex-col gap-2.5 border-b border-paper-line pb-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          set("q", new FormData(e.currentTarget).get("q"));
        }}
      >
        <input
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Name, phone, email, destination…"
          className="w-full rounded-xl border border-paper-line-strong bg-card px-4 py-2.5 text-[14px] outline-none focus:border-accent"
        />
      </form>

      <Row
        label="Due"
        options={DUE}
        active={due}
        onPick={(v) => set("due", v)}
      />

      <Row
        label="Stage"
        options={[{ value: "any", label: "All" }, ...LEAD_STAGES.map((s) => ({ value: s.value, label: s.label }))]}
        active={stage}
        onPick={(v) => set("stage", v)}
      />

      <Row label="Money" options={MONEY} active={money} onPick={(v) => set("money", v)} />

      {/* Only where the person may see other people's pipelines. Hiding it is
          presentation; the server enforces the scope regardless. */}
      {canSeeEveryone && staff.length > 0 && (
        <Row
          label="Owner"
          options={[
            { value: "any", label: "Everyone" },
            ...staff.map((u) => ({ value: u.id, label: u.name ?? u.email })),
          ]}
          active={owner}
          onPick={(v) => set("owner", v)}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] text-paper-text-faint">
          {filtered ? `${shown} of ${total} leads` : `${total} leads`}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="text-[12px] font-bold text-accent-deep"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
