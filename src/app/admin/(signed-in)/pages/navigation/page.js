import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { getNavigation, DEFAULT_MOBILE_EXTRA } from "@/lib/cms/navigation";
import MenuEditor from "@/components/cms/menu-editor";

export const metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

export default async function NavigationPage() {
  const user = await currentUser();
  if (!userCan(user, "content.write")) redirect("/admin");

  const nav = await getNavigation();

  // The editor works on the raw lists. `mobileLinks` is main + extras merged
  // for display, so the extras are sliced back out rather than shown twice.
  const extra = nav.mobileLinks.slice(nav.links.length);

  return (
    <>
      <header className="mb-5">
        <Link
          href="/admin/pages"
          className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text"
        >
          ← Pages
        </Link>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-tight text-paper-text">
          Menu &amp; footer
        </h1>
        <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-paper-text-muted">
          The menu at the top of every page. Changes go live when you save —
          there is no separate publish step, because a half-saved menu is worse
          than either version of it.
          {!nav.edited ? (
            <>
              {" "}
              <strong className="text-paper-text">
                This is currently the menu from the code.
              </strong>
            </>
          ) : null}
        </p>
      </header>

      <MenuEditor
        initialLinks={nav.links}
        initialExtra={extra.length ? extra : DEFAULT_MOBILE_EXTRA}
        initialFooter={nav.footer}
        edited={nav.edited}
      />
    </>
  );
}
