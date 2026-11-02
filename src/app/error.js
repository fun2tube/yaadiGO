"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, retry }) {
  useEffect(() => {
    // `error.digest` is the hash to match against the server logs — in
    // production the message itself is deliberately generic.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start px-6 py-24 sm:px-10">
      <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
        Something broke
      </span>
      <h1 className="mt-2 font-display text-[30px] font-medium text-paper-text sm:text-[36px]">
        That didn&apos;t load properly.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-paper-text-muted">
        It&apos;s on our side, not yours. Try again — and if it keeps
        happening, the trips are all still there from the homepage.
      </p>
      {error?.digest && (
        <p className="mt-3 text-[12px] text-paper-text-faint">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-ink-text"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-paper-line-strong px-6 py-3 text-[14px] font-semibold text-paper-text"
        >
          Back to the homepage
        </Link>
      </div>
    </main>
  );
}
