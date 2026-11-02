import Link from "next/link";
import SiteNav from "@/components/site-nav";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import { ChevronIcon } from "@/components/icons";
import { sortedPosts, formatPostDate } from "@/lib/posts";

export const metadata = {
  // "Blog" alone carried no topic signal at all — nothing in the title or the
  // description told a search engine, or a person reading a result, what these
  // posts are about. Both now name the subject and the kind of answer.
  title: "Travel Notes — Where and When to Go in India",
  description:
    "Straight answers to what people ask before booking: Kashmir or Himachal in October, Ladakh in June or September, GST credit on company travel.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = sortedPosts();

  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <section className="mx-auto max-w-4xl px-6 py-16 sm:px-10 sm:py-20">
          <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">Blog</span>
          <h1 className="mt-2 font-display text-[32px] font-medium text-paper-text sm:text-[40px]">
            Guides & notes from the desk
          </h1>
          <div className="mt-8 flex flex-col divide-y divide-paper-line">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex items-center justify-between gap-6 py-6"
              >
                <div>
                  <time
                    dateTime={post.date}
                    className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint"
                  >
                    {formatPostDate(post.date)}
                  </time>
                  <h2 className="mt-1 font-display text-[18px] font-medium leading-snug text-paper-text">
                    {post.title}
                  </h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-paper-text-muted">
                    {post.excerpt}
                  </p>
                </div>
                <ChevronIcon
                  size={16}
                  className="flex-shrink-0 text-paper-text-faint transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
