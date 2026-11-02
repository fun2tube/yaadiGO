import Link from "next/link";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import Reveal from "@/components/reveal";
import { media, attributionRequired } from "@/lib/media";

export const metadata = {
  title: "Photo Credits",
  description:
    "Photographers and licences for the images used on yaadigo.com. All photography is freely licensed and cleared for commercial use.",
  alternates: { canonical: "/credits" },
};

export default function CreditsPage() {
  // CC BY and CC BY-SA require attribution wherever the work is used. This
  // page is how that obligation is met, and the footer links to it.
  const needsCredit = attributionRequired();
  const publicDomain = media.filter((item) => !needsCredit.includes(item));

  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <section className="mx-auto max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
          <span className="eyebrow text-accent-deep">Credits</span>
          <h1 className="mt-2 font-display text-[32px] font-bold tracking-tight text-paper-text sm:text-[40px]">
            Photo credits
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-paper-text-muted">
            Every photograph on this site is freely licensed and cleared for commercial use. The
            images below carry attribution-required licences, and this page is how we honour that.
            Photographs are the work of their photographers, not of YaadiGo.
          </p>

          <div className="mt-10">
            <h2 className="eyebrow text-paper-text-faint">
              Attribution required ({needsCredit.length})
            </h2>
            <ul className="mt-4 flex flex-col divide-y divide-paper-line">
              {needsCredit.map((item) => (
                <li key={item.id} className="py-3.5">
                  <p className="text-[14px] font-semibold text-paper-text">{item.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-paper-text-muted">
                    {item.credit.author}
                    {" · "}
                    {item.credit.licenceUrl ? (
                      <a
                        href={item.credit.licenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {item.credit.licence}
                      </a>
                    ) : (
                      item.credit.licence
                    )}
                    {item.credit.sourceUrl && (
                      <>
                        {" · via "}
                        <a
                          href={item.credit.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {item.credit.source}
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {publicDomain.length > 0 && (
            <div className="mt-10">
              <h2 className="eyebrow text-paper-text-faint">
                Public domain / CC0 ({publicDomain.length})
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {publicDomain.map((item) => (
                  <li key={item.id} className="text-[13.5px] text-paper-text-muted">
                    {item.title} — {item.credit.licence}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-10 text-[13px] leading-relaxed text-paper-text-faint">
            If you are a photographer here and would like a credit corrected or an image removed,{" "}
            <Link href="/contact" className="text-accent-deep underline">
              tell us
            </Link>{" "}
            and we will act on it.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
