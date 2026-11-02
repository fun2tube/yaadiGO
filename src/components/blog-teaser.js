import Link from "next/link";
import { ChevronIcon } from "./icons";
import { sortedPosts } from "@/lib/posts";

export default function BlogTeaser() {
  const posts = sortedPosts().slice(0, 3);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
            From the blog
          </span>
          <h2 className="mt-2 font-display text-[28px] font-medium text-paper-text sm:text-[32px]">
            Guides & notes from the desk
          </h2>
        </div>
        <Link href="/blog" className="flex items-center gap-1 text-[14px] font-semibold text-paper-text">
          Read the blog <ChevronIcon size={15} />
        </Link>
      </div>

      <div data-reveal className="mt-8 grid gap-5 sm:grid-cols-3">
        {posts.map((post) => (
          <Link
            data-reveal
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col gap-2 rounded-xl border border-paper-line p-5 transition-colors hover:border-paper-line-strong"
          >
            <h3 className="font-display text-[16px] font-medium leading-snug text-paper-text">
              {post.title}
            </h3>
            <p className="text-[13px] leading-relaxed text-paper-text-muted">{post.excerpt}</p>
            <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-accent-deep">
              Read <ChevronIcon size={12} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
