"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * The desk's corrections to a customer: spelling, a second number, the
 * company, notes and marketing consent. Website enquiries never overwrite
 * these (lib/crm/customers.js fills blanks only), so a fix made here sticks.
 */

const FIELDS = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "company", label: "Company", type: "text" },
  { key: "city", label: "City", type: "text" },
];

export default function CustomerEditor({ customer }) {
  const [form, setForm] = useState({
    name: customer.name ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    company: customer.company ?? "",
    city: customer.city ?? "",
    notes: customer.notes ?? "",
    tags: (customer.tags ?? []).join(", "),
    marketingConsent: Boolean(customer.marketingConsent),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const router = useRouter();

  const set = (key) => (event) =>
    setForm((f) => ({ ...f, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customer.id,
          ...form,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ok: false, text: data.message ?? "That didn't save. Try again.", clashId: data.clashId });
        return;
      }
      setMessage({ ok: true, text: "Saved." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "No connection. Nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-paper-line-strong bg-card px-3 py-2 text-[13px] text-paper-text";

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-2xl border border-paper-line bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-[12px] font-semibold text-paper-text-muted">
            {f.label}
            <input type={f.type} required={f.required} value={form[f.key]} onChange={set(f.key)} className={input} />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-paper-text-muted">
          Tags <span className="font-normal text-paper-text-faint">comma separated, e.g. honeymoon, corporate, VIP</span>
          <input type="text" value={form.tags} onChange={set("tags")} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-paper-text-muted">
        Notes
        <textarea rows={3} value={form.notes} onChange={set("notes")} className={input} />
      </label>
      <label className="flex items-start gap-2 text-[12.5px] text-paper-text">
        <input type="checkbox" checked={form.marketingConsent} onChange={set("marketingConsent")} className="mt-0.5" />
        <span>
          Agreed to receive offers and trip news.{" "}
          <span className="text-paper-text-faint">Tick only when they said yes; the date is recorded.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-xl bg-ink px-4 py-2 text-[12.5px] font-bold text-ink-text disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
        {message ? (
          <span className={`flex items-center gap-1.5 text-[12.5px] ${message.ok ? "text-good" : "text-danger"}`}>
            {message.ok ? <CheckIcon size={12} /> : <AlertIcon size={13} />} {message.text}
            {message.clashId ? (
              <a href={`/admin/customers/${message.clashId}`} className="font-semibold underline">
                Open them
              </a>
            ) : null}
          </span>
        ) : null}
      </div>
    </form>
  );
}
