"use client";

import { useState } from "react";
import { MODULES, ROLES, ROLE_VALUES, USER_STATUSES } from "@/lib/crm/schema";
import { AlertIcon, CheckIcon, ChevronIcon, UsersIcon } from "@/components/icons";

/**
 * The team.
 *
 * Arranged around the queue an admin actually works: people waiting for
 * approval come first and loudly, because someone who set up their account and
 * cannot sign in will be messaging you within the hour.
 *
 * Module access is a grid of checkboxes rather than a role dropdown alone.
 * Roles are presets; the real question is "can Priya see Operations", and the
 * answer should be one tap, not a support request.
 */

const field =
  "w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-accent";
const label = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint";

const TONES = {
  neutral: "bg-paper-line-strong text-paper-text-muted",
  warn: "bg-warn/20 text-warn",
  good: "bg-good/15 text-good",
  danger: "bg-danger/10 text-danger",
};

function StatusPill({ status }) {
  const meta = USER_STATUSES.find((s) => s.value === status) ?? USER_STATUSES[0];
  return (
    <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${TONES[meta.tone]}`}>
      {meta.label}
    </span>
  );
}

function InvitePanel({ onInvited }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "sales" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        return;
      }
      setResult(data);
      setForm({ email: "", name: "", role: "sales" });
      onInvited?.();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-paper-line-strong px-4 py-3.5 text-[14px] font-bold text-accent-deep transition-colors hover:border-accent"
      >
        + Invite someone
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <h2 className="text-[14px] font-bold text-paper-text">Invite a team member</h2>

      <div className="mt-3 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className={label}>Work email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="priya@yaadigo.com"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Name (optional)</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Starting role</span>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={field}
          >
            {ROLE_VALUES.map((value) => (
              <option key={value} value={value}>
                {ROLES[value].label} — {ROLES[value].blurb}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
          <AlertIcon size={13} /> {error}
        </p>
      )}

      {/* The link only appears when email could not send it. Copying a bearer
          token out of a screen is not ideal, but it beats an invite flow that
          dead-ends on a project with no mail provider. */}
      {result?.link && (
        <div className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3">
          <p className="text-[12.5px] font-bold text-paper-text">
            No email provider — send this link yourself
          </p>
          <p className="mt-1 text-[11.5px] text-paper-text-muted">
            It works once and expires in 72 hours.
          </p>
          <input
            readOnly
            value={result.link}
            onFocus={(e) => e.target.select()}
            className="mt-2 w-full rounded-lg border border-paper-line-strong bg-paper px-2.5 py-2 font-mono text-[11px]"
          />
        </div>
      )}

      {result && !result.link && (
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-good">
          <CheckIcon size={13} /> Invitation emailed.
        </p>
      )}

      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={send}
          disabled={busy || !form.email}
          className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "Sending…" : "Send invitation"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
            setError(null);
          }}
          className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-semibold text-paper-text-muted"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function MemberCard({ member, onPatch, busy, error }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(member.role);
  const [permissions, setPermissions] = useState(member.permissions ?? []);

  const isAdmin = permissions.includes("*");

  function toggle(permission) {
    setPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
    );
  }

  const dirty =
    role !== member.role ||
    JSON.stringify([...permissions].sort()) !==
      JSON.stringify([...(member.permissions ?? [])].sort());

  return (
    <article className="overflow-hidden rounded-2xl border border-paper-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-paper-text">
              {member.name ?? member.email}
            </span>
            <StatusPill status={member.status} />
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-paper-text-faint">
            {member.email} · {ROLES[member.role]?.label ?? member.role}
            {member.lastSignInAt
              ? ` · last in ${new Date(member.lastSignInAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}`
              : " · never signed in"}
          </p>
        </div>
        <ChevronIcon
          size={14}
          className={`mt-1 shrink-0 text-paper-text-faint transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {member.status === "pending" && (
        <div className="flex items-center justify-between gap-3 border-t border-warn/30 bg-warn/10 px-4 py-3">
          <p className="text-[12.5px] font-semibold text-paper-text">
            Waiting for you to approve them.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(member.id, { action: "approve" })}
            className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            Approve
          </button>
        </div>
      )}

      {open && (
        <div className="border-t border-paper-line px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className={label}>Role</span>
            <select
              value={role}
              onChange={(e) => {
                const next = e.target.value;
                setRole(next);
                // Changing the role reseeds the ticks, so the grid always
                // shows what will actually be saved.
                setPermissions([...(ROLES[next]?.permissions ?? [])]);
              }}
              className={field}
            >
              {ROLE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {ROLES[value].label}
                </option>
              ))}
            </select>
          </label>

          <p className={`${label} mt-4`}>Modules</p>
          {isAdmin ? (
            <p className="mt-1.5 rounded-xl bg-paper-dim px-3 py-2.5 text-[12.5px] text-paper-text-muted">
              An admin has every module, including the team and the website.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {MODULES.map((module) => {
                const canRead = permissions.includes(module.read);
                const canWrite = module.write ? permissions.includes(module.write) : false;
                return (
                  <div
                    key={module.key}
                    className="flex items-start justify-between gap-3 rounded-xl border border-paper-line px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-paper-text">{module.label}</p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-paper-text-muted">
                        {module.blurb}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(module.read)}
                        className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-bold transition-all ${
                          canRead
                            ? "bg-ink text-ink-text"
                            : "border border-paper-line-strong text-paper-text-faint"
                        }`}
                      >
                        View
                      </button>
                      {module.write && (
                        <button
                          type="button"
                          onClick={() => toggle(module.write)}
                          className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] font-bold transition-all ${
                            canWrite
                              ? "bg-accent text-white"
                              : "border border-paper-line-strong text-paper-text-faint"
                          }`}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
              <AlertIcon size={13} /> {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => onPatch(member.id, { action: "update", role, permissions })}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : dirty ? "Save access" : "No changes"}
            </button>
            {member.status === "active" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPatch(member.id, { action: "suspend" })}
                className="rounded-xl border border-danger/40 px-4 py-2.5 text-[13px] font-semibold text-danger disabled:opacity-40"
              >
                Suspend
              </button>
            ) : member.status === "suspended" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPatch(member.id, { action: "reactivate" })}
                className="rounded-xl border border-paper-line-strong px-4 py-2.5 text-[13px] font-semibold text-paper-text-muted disabled:opacity-40"
              >
                Reactivate
              </button>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}

export default function TeamBoard({ initialUsers }) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState(null);
  const [errors, setErrors] = useState({});

  async function refresh() {
    const response = await fetch("/api/admin/team").catch(() => null);
    if (!response?.ok) return;
    const data = await response.json();
    setUsers(data.users);
  }

  async function patch(id, body) {
    setBusyId(id);
    setErrors((prev) => ({ ...prev, [id]: null }));
    try {
      const response = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors((prev) => ({ ...prev, [id]: data.message ?? "That didn't save." }));
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
    } catch {
      setErrors((prev) => ({ ...prev, [id]: "Couldn't reach the server." }));
    } finally {
      setBusyId(null);
    }
  }

  const pending = users.filter((u) => u.status === "pending");
  const rest = users.filter((u) => u.status !== "pending");

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3.5">
          <p className="flex items-center gap-2 text-[13.5px] font-bold text-paper-text">
            <UsersIcon size={15} />
            {pending.length} {pending.length === 1 ? "person is" : "people are"} waiting for
            approval
          </p>
          <p className="mt-1 text-[12.5px] text-paper-text-muted">
            They have set a password and cannot sign in until you approve them.
          </p>
        </div>
      )}

      <InvitePanel onInvited={refresh} />

      <div className="flex flex-col gap-2.5">
        {[...pending, ...rest].map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            onPatch={patch}
            busy={busyId === member.id}
            error={errors[member.id]}
          />
        ))}
      </div>
    </div>
  );
}
