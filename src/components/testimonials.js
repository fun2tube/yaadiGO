import { StarIcon } from "./icons";
import { testimonials } from "@/lib/testimonials";

export default function Testimonials() {
  // Nothing collected yet — render nothing rather than empty placeholders.
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-paper-dim">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
        <span className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
          What people say
        </span>
        <h2 className="mt-2 font-display text-[28px] font-medium text-paper-text sm:text-[32px]">
          Traveller reviews & client stories
        </h2>

        <div data-reveal className="mt-8 grid gap-5 sm:grid-cols-3">
          {testimonials.map((item) => (
            <figure
              key={item.quote}
              className="flex flex-col gap-3 rounded-2xl border border-paper-line bg-card p-6"
            >
              {item.rating && (
                <div className="flex gap-0.5 text-accent" aria-label={`${item.rating} out of 5`}>
                  {[...Array(item.rating)].map((_, s) => (
                    <StarIcon key={s} size={13} />
                  ))}
                </div>
              )}
              <blockquote className="text-[13.5px] leading-relaxed text-paper-text-muted">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-auto">
                <span className="block text-[13.5px] font-semibold text-paper-text">
                  {item.name}
                </span>
                {item.context && (
                  <span className="block text-[12.5px] text-paper-text-faint">{item.context}</span>
                )}
                <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-paper-text-faint">
                  {item.type}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
