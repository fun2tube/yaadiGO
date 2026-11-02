import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import MediaGallery from "@/components/media-gallery";
import { media } from "@/lib/media";

// Internal tooling, not a marketing page — kept out of search results and out
// of the sitemap. It is a route rather than a script so the team can browse
// the library without running anything.
export const metadata = {
  title: "Media library",
  description: "Internal image library for the YaadiGo website.",
  robots: { index: false, follow: false },
};

export default function MediaPage() {
  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
          <span className="eyebrow text-accent-deep">Internal</span>
          <h1 className="mt-2 font-display text-[32px] font-bold tracking-tight text-paper-text sm:text-[40px]">
            Media library
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper-text-muted">
            Every image on the site, with its alt text, description, tags and licence. Find one,
            copy its tag, and drop it on a page — the alt text travels with it, so it can never be
            forgotten or re-written differently in two places.
          </p>

          <div className="mt-6 rounded-2xl border border-paper-line bg-paper-dim p-5">
            <h2 className="eyebrow text-paper-text-faint">Adding an image</h2>
            <ol className="mt-2.5 flex flex-col gap-1.5 text-[13.5px] leading-relaxed text-paper-text-muted">
              <li>1. Put the file in <code className="font-mono text-[12px] text-paper-text">public/media/</code></li>
              <li>2. Add an entry to <code className="font-mono text-[12px] text-paper-text">src/lib/media.js</code> with alt, title, description, tags and credit</li>
              <li>3. Use it anywhere with <code className="font-mono text-[12px] text-paper-text">&lt;Img id=&quot;your-id&quot; /&gt;</code></li>
            </ol>
            <p className="mt-3 text-[12.5px] leading-relaxed text-paper-text-faint">
              {media.length} images currently registered. All are freely licensed and cleared for
              commercial use — NonCommercial and NoDerivatives licences are rejected on principle,
              since this is a commercial site.
            </p>
          </div>

          <div className="mt-8">
            <MediaGallery />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
