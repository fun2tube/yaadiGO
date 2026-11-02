import SiteNav from "./site-nav";
import Reveal from "./reveal";
import SiteFooter from "./site-footer";
import { LEGAL_LAST_UPDATED } from "@/lib/site";

// Shared shell for /privacy and /terms — both are the same long-form
// document, so the layout lives in one place and each page supplies content.
export default function LegalDoc({ eyebrow, title, intro, sections }) {
  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <article className="mx-auto max-w-3xl px-6 py-16 sm:px-10 sm:py-20">
          <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
            {eyebrow}
          </span>
          <h1 className="mt-2 font-display text-[32px] font-medium text-paper-text sm:text-[40px]">
            {title}
          </h1>
          <p className="mt-3 text-[13px] text-paper-text-faint">
            Last updated {LEGAL_LAST_UPDATED}
          </p>
          <p className="mt-6 text-[15px] leading-relaxed text-paper-text-muted">{intro}</p>

          <div className="mt-10 flex flex-col gap-9">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-[20px] font-medium text-paper-text">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((para, i) => (
                  <p key={i} className="mt-3 text-[14.5px] leading-relaxed text-paper-text-muted">
                    {para}
                  </p>
                ))}
                {section.list && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {section.list.map((item, i) => (
                      <li
                        key={i}
                        className="flex gap-2.5 text-[14.5px] leading-relaxed text-paper-text-muted"
                      >
                        <span aria-hidden="true" className="mt-[9px] h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
