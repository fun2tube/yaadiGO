"use client"; // Replaces the root layout entirely, so it ships its own document.

import "./globals.css";

export default function GlobalError({ error, retry }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-start justify-center bg-paper px-6 font-body text-ink sm:px-10">
        <title>Something went wrong | YaadiGo</title>
        <h1 className="font-display text-[30px] font-medium">
          Something went wrong.
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper-text-muted">
          The page failed to load. Trying again usually fixes it.
        </p>
        {error?.digest && (
          <p className="mt-3 text-[12px] text-paper-text-faint">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => retry()}
          className="mt-8 rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-ink-text"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
