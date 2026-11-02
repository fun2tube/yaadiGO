import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { storageIsDurable } from "@/lib/cms/records";
import { inboxFor } from "@/lib/crm/notifications";
import AdminNav from "@/components/cms/admin-nav";
import { AlertIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Admin", template: "%s · YaadiGo Admin" },
  robots: { index: false, follow: false },
};

/**
 * The admin shell.
 *
 * Mobile-first in the literal sense: the primary navigation is a bottom tab
 * bar, because the people using this are a travel desk checking leads on a
 * phone between calls, not analysts at a desk. The sidebar is the enhancement
 * that appears on a wide screen, not the other way round.
 *
 * Auth is enforced here, once, for every page beneath it — a new admin page
 * cannot forget to check.
 *
 * It lives in a (signed-in) route group rather than directly at /admin so the
 * sign-in page sits OUTSIDE the guard. When it wrapped everything under
 * /admin, a signed-out visitor opening /admin/login was redirected to
 * /admin/login, and the browser gave up with a redirect loop — the one page
 * that must be reachable without a session was the one page that wasn't.
 */
export default async function AdminLayout({ children }) {
  // The user, not just a yes/no: the navigation shows only the modules this
  // person has been given, so a salesperson never sees a Team tab that would
  // 403 the moment they tapped it.
  const user = await currentUser();
  if (!user) redirect("/admin/login");

  const durable = storageIsDurable();
  // Server-rendered so the badge is right on first paint, with no effect.
  const { unread } = await inboxFor(user.id, { limit: 1 });

  return (
    <div className="min-h-dvh bg-paper-dim">
      {!durable && (
        <div className="flex items-start gap-2 bg-warn/15 px-4 py-2.5 text-[12px] leading-snug text-paper-text">
          <span className="mt-0.5 shrink-0 text-warn">
            <AlertIcon size={13} />
          </span>
          <span>
            This host resets its filesystem on deploy — leads and edits saved here will be lost.
            Connect a database before using this in production.
          </span>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl gap-0 lg:gap-8 lg:px-6">
        <AdminNav user={user} unread={unread} />

        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-0 lg:pb-12">
          {children}
        </main>
      </div>

      <footer className="hidden px-6 pb-8 text-center lg:block">
        <Link href="/" className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text">
          ← back to the site
        </Link>
      </footer>
    </div>
  );
}
