"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * The form behind an emailed link — accepting an invitation, or resetting a
 * password. One component because the shape is identical: validate the token,
 * take a new password, confirm it, report what happens next.
 *
 * The token is checked BEFORE the form is drawn. Letting someone type a name
 * and a password and only then saying "that link expired" is a small cruelty
 * that is entirely avoidable.
 */

const field =
  "w-full rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[15px] outline-none focus:border-accent";

function strength(password) {
  if (!password) return null;
  if (password.length < 10) return { ok: false, text: "At least 10 characters" };
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, text: "Include a letter and a number" };
  }
  return { ok: true, text: "Strong enough" };
}

export default function TokenForm({ mode, token }) {
  const invite = mode === "invite";

  const [checking, setChecking] = useState(invite);
  const [invalid, setInvalid] = useState(null);
  const [account, setAccount] = useState(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!invite) return;
    let cancelled = false;

    (async () => {
      const response = await fetch(
        `/api/admin/auth/invite?token=${encodeURIComponent(token)}`
      ).catch(() => null);
      const data = await response?.json().catch(() => ({}));
      if (cancelled) return;

      if (!response?.ok || !data?.valid) {
        setInvalid(
          data?.reason === "expired"
            ? "That invitation has expired. Ask whoever invited you for a new link."
            : "That invitation link isn't valid."
        );
      } else {
        setAccount(data);
        setName(data.name ?? "");
      }
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [invite, token]);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setBusy(true);
    setError(null);

    const response = await fetch(
      invite ? "/api/admin/auth/invite" : "/api/admin/auth/reset",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite ? { token, name, password } : { token, password }),
      }
    ).catch(() => null);

    const data = await response?.json().catch(() => ({}));
    setBusy(false);

    if (!response?.ok) {
      setError(data?.message ?? "Couldn't reach the server.");
      return;
    }
    setDone(data.message);
  }

  if (checking) {
    return <p className="mt-6 text-[14px] text-paper-text-muted">Checking your invitation…</p>;
  }

  if (invalid) {
    return (
      <div className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-4">
        <p className="flex items-start gap-2 text-[13.5px] font-semibold text-paper-text">
          <span className="mt-0.5 shrink-0 text-danger">
            <AlertIcon size={14} />
          </span>
          {invalid}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-good/40 bg-good/10 p-4">
        <p className="flex items-start gap-2 text-[13.5px] font-semibold text-paper-text">
          <span className="mt-0.5 shrink-0 text-good">
            <CheckIcon size={14} />
          </span>
          {done}
        </p>
        <Link href="/admin/login" className="mt-3 inline-block text-[13px] font-bold text-accent-deep">
          Go to sign in
        </Link>
      </div>
    );
  }

  const meter = strength(password);

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
      {account && (
        <p className="rounded-xl bg-paper-dim px-3.5 py-2.5 text-[13px] text-paper-text-muted">
          {account.invitedByName ? `${account.invitedByName} invited ` : "Invitation for "}
          <strong className="font-semibold text-paper-text">{account.email}</strong>
          {account.role ? ` as ${account.role}` : ""}.
        </p>
      )}

      {invite && (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
          required
          className={field}
        />
      )}

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={invite ? "Choose a password" : "New password"}
        autoComplete="new-password"
        required
        className={field}
      />
      {meter && (
        <p className={`text-[12px] font-semibold ${meter.ok ? "text-good" : "text-paper-text-faint"}`}>
          {meter.text}
        </p>
      )}

      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        autoComplete="new-password"
        required
        className={field}
      />

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-[12.5px] font-semibold text-danger">
          <span className="mt-0.5 shrink-0">
            <AlertIcon size={13} />
          </span>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !password || !confirm || (invite && !name)}
        className="rounded-xl bg-accent px-6 py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : invite ? "Create my account" : "Set new password"}
      </button>

      {invite && (
        <p className="text-center text-[12px] leading-relaxed text-paper-text-faint">
          An admin approves your account before you can sign in.
        </p>
      )}
    </form>
  );
}
