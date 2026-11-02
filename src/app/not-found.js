import Link from "next/link";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import { ChevronIcon } from "@/components/icons";

export const metadata = {
  title: "Page not found",
};

const SUGGESTIONS = [
  { href: "/group-tours", label: "Group Tours", detail: "Fixed departures with dates and seats" },
  { href: "/customized-tours", label: "Customized Tours", detail: "A trip built around your dates" },
  { href: "/corporate-travel", label: "Corporate Travel", detail: "The business travel desk" },
  { href: "/blog", label: "Blog", detail: "Guides and notes from the desk" },
];

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="pt-[84px]">
        <section className="mx-auto max-w-3xl px-6 py-20 sm:px-10 sm:py-28">
          <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
            404
          </span>
          <h1 className="mt-2 font-display text-[32px] font-medium text-paper-text sm:text-[40px]">
            That page has moved on without us.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-paper-text-muted">
            The link may be old, or the trip it pointed to may have finished
            its season. Here&apos;s where most people are headed:
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between gap-4 rounded-xl border border-paper-line bg-card p-5"
              >
                <span>
                  <span className="block text-[14.5px] font-semibold text-paper-text">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-paper-text-muted">
                    {item.detail}
                  </span>
                </span>
                <ChevronIcon
                  size={15}
                  className="flex-shrink-0 text-paper-text-faint transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
          </div>

          <Link
            href="/"
            className="mt-8 inline-flex rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-ink-text"
          >
            Back to the homepage
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
