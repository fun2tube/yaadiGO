"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * Sign in.
 *
 * Three states share this form on purpose — password, Google, and "I forgot" —
 * because they are the same decision at the same moment. Sending someone to a
 * separate page to reset a password is where a lot of people give up.
 */

const ERRORS = {
  "google-unconfigured": "Google sign-in isn't set up on this server yet. Use your password.",
  "google-state": "That sign-in attempt expired. Try again.",
  "google-failed": "Google couldn't complete the sign-in. Try again, or use your password.",
  "google-unknown":
    "That Google account isn't on the team. Ask an admin to invite your work email first.",
  pending: "Your account is waiting for an admin to approve it.",
  suspended: "That account has been suspended. Ask an admin.",
};

const field =
  "w-full rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[15px] outline-none focus:border-accent";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

export default function LoginForm({ googleEnabled, initialError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | forgot
  const [error, setError] = useState(ERRORS[initialError] ?? null);
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const endpoint = mode === "forgot" ? "/api/admin/auth/reset" : "/api/admin/login";
    const body = mode === "forgot" ? { email } : { email, password };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    const data = await response?.json().catch(() => ({}));
    setBusy(false);

    if (!response?.ok) {
      setError(data?.message ?? "Couldn't reach the server.");
      return;
    }

    if (mode === "forgot") {
      setSent(data.message);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-xl border border-good/40 bg-good/10 p-4">
        <p className="flex items-start gap-2 text-[13.5px] font-semibold text-paper-text">
          <span className="mt-0.5 shrink-0 text-good">
            <CheckIcon size={14} />
          </span>
          {sent}
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setMode("signin");
          }}
          className="mt-3 text-[13px] font-bold text-accent-deep"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {googleEnabled && mode === "signin" && (
        <>
          <a
            href="/api/admin/auth/google"
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[14.5px] font-bold text-paper-text transition-colors hover:border-accent"
          >
            <GoogleMark />
            Continue with Google
          </a>
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-paper-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper-text-faint">
              or
            </span>
            <span className="h-px flex-1 bg-paper-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          autoComplete="username"
          autoFocus
          required
          className={field}
        />

        {mode === "signin" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className={field}
          />
        )}

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
          disabled={busy || !email || (mode === "signin" && !password)}
          className="rounded-xl bg-accent px-6 py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {busy
            ? mode === "forgot"
              ? "Sending…"
              : "Signing in…"
            : mode === "forgot"
              ? "Send reset link"
              : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "forgot" ? "signin" : "forgot");
          setError(null);
        }}
        className="mt-3 w-full text-center text-[13px] font-semibold text-paper-text-muted hover:text-accent-deep"
      >
        {mode === "forgot" ? "Back to sign in" : "Forgot your password?"}
      </button>
    </div>
  );
}
