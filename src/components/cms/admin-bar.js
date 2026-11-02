"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEditMode } from "./edit-mode";
import { SparkleIcon, CheckIcon } from "@/components/icons";

/**
 * The admin bar: only rendered for a signed-in admin, on top of the real site.
 * Toggling edit mode changes nothing about what visitors get — it only makes
 * the page clickable for the person editing it.
 */
export default function AdminBar() {
  const { active, setActive, storage, selected } = useEditMode();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="no-print fixed left-1/2 top-3 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-ink-line-strong bg-ink/95 px-2.5 py-2 shadow-2xl backdrop-blur-xl">
      <span className="hidden px-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-text-faint sm:block">
        Admin
      </span>

      <button
        type="button"
        onClick={() => setActive(!active)}
        aria-pressed={active}
        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
          active ? "bg-accent text-white" : "bg-ink-soft text-ink-text hover:bg-ink-softer"
        }`}
      >
        {active ? <CheckIcon size={13} /> : <SparkleIcon size={13} />}
        {active ? "Editing" : "Edit page"}
      </button>

      {active && !selected && (
        <span className="hidden max-w-[200px] px-1 text-[11.5px] leading-snug text-ink-text-muted md:block">
          Click any outlined element
        </span>
      )}

      <Link
        href="/admin"
        className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-ink-text-muted transition-colors hover:text-ink-text"
      >
        Dashboard
      </Link>

      <button
        type="button"
        onClick={signOut}
        className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-ink-text-faint transition-colors hover:text-ink-text"
      >
        Sign out
      </button>

      {!storage?.durable && (
        <span
          title={storage?.message}
          className="rounded-lg bg-warn/20 px-2 py-1 font-mono text-[10px] font-bold text-warn"
        >
          not persisted
        </span>
      )}
    </div>
  );
}
