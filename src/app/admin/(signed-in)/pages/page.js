import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { listPages } from "@/lib/cms/pages";

export const metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

/**
 * Which pages can be built visually.
 *
 * A fixed list, not "every route". The builder is for MARKETING pages — the
 * planner, the trip pages, quotations and the CRM are application surfaces
 * where a drag-and-drop layout has nothing to offer but risk. Adding a route
 * here is a deliberate decision, which is the point.
 */
const BUILDABLE = [
  { path: "/", label: "Home", note: "The one visitors land on" },
  { path: "/about", label: "About", note: "Who we are" },
  { path: "/contact", label: "Contact", note: "Enquiry form sits below the blocks" },
  { path: "/corporate-travel", label: "Corporate Travel", note: "B2B landing page" },
];

export default async function PagesIndex() {
  const user = await currentUser();
  if (!userCan(user, "content.write")) redirect("/admin");

  const saved = await listPages();
  const byKey = new Map(saved.map((row) => [row.key, row]));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[24px] font-bold tracking-tight text-paper-text">Pages</h1>
        <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-paper-text-muted">
          Build a page by dragging blocks. Nothing changes for visitors until you
          press Publish, and <strong>Revert</strong> always puts the original
          page back.
        </p>
      </header>

      <div className="flex flex-col gap-2.5">
        {BUILDABLE.map((page) => {
          const row = byKey.get(page.path === "/" ? "home" : page.path.replace(/^\//, ""));
          const live = Boolean(row?.published?.content?.length);
          const draft = Boolean(row?.draft?.content?.length);

          return (
            <Link
              key={page.path}
              href={`/admin/pages/edit?path=${encodeURIComponent(page.path)}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-paper-line bg-card p-4 transition-colors hover:border-accent/40"
            >
              <div className="min-w-0">
                <span className="flex items-center gap-2 text-[14.5px] font-bold text-paper-text">
                  {page.label}
                  <code className="font-mono text-[11px] font-normal text-paper-text-faint">
                    {page.path}
                  </code>
                </span>
                <p className="mt-0.5 text-[12.5px] text-paper-text-muted">{page.note}</p>
              </div>

              <span
                className={`shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-bold ${
                  live
                    ? "bg-good/15 text-good"
                    : draft
                      ? "bg-warn/15 text-warn"
                      : "bg-paper-dim text-paper-text-faint"
                }`}
              >
                {live ? "BUILT" : draft ? "DRAFT" : "FROM CODE"}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href="/admin/pages/navigation"
        className="mt-2.5 flex items-center justify-between gap-4 rounded-2xl border border-paper-line bg-card p-4 transition-colors hover:border-accent/40"
      >
        <div className="min-w-0">
          <span className="text-[14.5px] font-bold text-paper-text">Menu</span>
          <p className="mt-0.5 text-[12.5px] text-paper-text-muted">
            The links at the top of every page — rename, reorder, add, remove
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-paper-dim px-2 py-1 font-mono text-[10px] font-bold text-paper-text-faint">
          SITE-WIDE
        </span>
      </Link>

      <p className="mt-5 max-w-xl text-[12.5px] leading-relaxed text-paper-text-faint">
        <strong className="text-paper-text-muted">From code</strong> means the
        page is the one developers ship. Build it here and it becomes yours;
        revert and it goes back. Trip pages, the AI planner and quotations are
        deliberately not listed — those are tools, not pages.
      </p>
    </>
  );
}
