import { notFound } from "next/navigation";
import Link from "next/link";
import { posts, getPostBySlug, formatPostDate } from "@/lib/posts";
import SiteNav from "@/components/site-nav";
import Reveal from "@/components/reveal";
import ScrollProgress from "@/components/scroll-progress";
import SiteFooter from "@/components/site-footer";
import JsonLd from "@/components/json-ld";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { ChevronIcon } from "@/components/icons";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

/**
 * One block of a post body.
 *
 * A post used to be a flat array of paragraphs, which is fine for three
 * corporate notes and wrong for the decision-query articles the content plan
 * calls for: those need headings a reader can skim to the one section they
 * came for, and lists a search engine or an assistant can lift verbatim.
 *
 * Plain strings still render as paragraphs, so the existing posts are
 * untouched.
 */
function Block({ block }) {
  if (typeof block === "string") {
    return <p className="text-[15px] leading-relaxed text-paper-text-muted">{block}</p>;
  }

  if (block.h) {
    return (
      <h2 className="mt-6 font-display text-[21px] font-bold leading-snug text-paper-text">
        {block.h}
      </h2>
    );
  }

  if (block.list) {
    return (
      <ul className="flex flex-col gap-2 pl-1">
        {block.list.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-paper-text-muted">
            <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent-deep" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  /* The honest-caveat block. Every one of these articles recommends something,
     and a recommendation without its failure case is marketing. */
  if (block.note) {
    return (
      <p className="rounded-2xl border border-paper-line bg-paper-dim px-5 py-4 text-[14.5px] leading-relaxed text-paper-text-muted">
        <strong className="font-bold text-paper-text">Worth knowing — </strong>
        {block.note}
      </p>
    );
  }

  return null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  /**
   * FAQPage schema.
   *
   * This is the one piece of markup that decides whether an AI assistant can
   * quote the answer when somebody asks it out loud — and spoken questions are
   * exactly the phrasing these blocks are written in. Emitted only when the
   * post actually carries questions, because an empty FAQPage is a structured
   * -data error rather than a neutral no-op.
   */
  const faqs = post.faqs ?? [];
  const faqSchema = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }
    : null;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 2, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <ScrollProgress />
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <article className="mx-auto max-w-2xl px-6 py-16 sm:px-10 sm:py-20">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-[12.5px] text-paper-text-faint">
            <Link href="/blog" className="hover:text-paper-text">Blog</Link>
            <ChevronIcon size={11} />
            <span className="truncate text-paper-text-muted">{post.title}</span>
          </nav>
          <h1 className="font-display text-[28px] font-medium leading-[1.25] text-paper-text sm:text-[34px]">
            {post.title}
          </h1>
          <time
            dateTime={post.date}
            className="mt-3 block text-[13px] text-paper-text-faint"
          >
            {formatPostDate(post.date)}
          </time>
          <div className="mt-8 flex flex-col gap-4">
            {post.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          {faqs.length > 0 && (
            <section className="mt-12 border-t border-paper-line pt-8">
              <h2 className="font-display text-[20px] font-bold text-paper-text">
                Questions people actually ask
              </h2>
              <dl className="mt-5 flex flex-col gap-5">
                {faqs.map((item) => (
                  <div key={item.q}>
                    <dt className="text-[14.5px] font-bold text-paper-text">{item.q}</dt>
                    <dd className="mt-1.5 text-[14.5px] leading-relaxed text-paper-text-muted">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
