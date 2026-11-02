import Img from "@/components/img";
import { LogoMark } from "@/components/icons";
import { money, QUOTE_LINE_KINDS } from "@/lib/crm/schema";
import { paymentSchedule } from "@/lib/crm/quote-content";
import { hasContent } from "@/lib/slot-text";
import { CONTACT, ADDRESS, REGISTRATION, ORG_LEGAL_NAME, formattedAddress } from "@/lib/site";

/**
 * Shared quotation blocks.
 *
 * All three templates render the SAME components for anything carrying a
 * figure, a date or a policy. Only layout and which blocks appear differ.
 *
 * That is the rule that matters: changing template must never change a number.
 * Three hand-written costing tables would drift, and the one that drifts is the
 * one a customer holds you to.
 */

/**
 * An image that vanishes when it has nothing to show.
 *
 * A missing hotel photo must look like a decision, not a fault — a broken frame
 * or an empty grey box on a ₹2,00,000 proposal reads as carelessness.
 * `src` is either a media-library id or a pasted URL, because there is no file
 * upload until object storage exists.
 */
export function QuoteImage({ id, url, alt, className = "", sizes }) {
  if (!id && !url) return null;

  if (id) {
    return (
      <div className={`quote-image relative overflow-hidden ${className}`}>
        <Img id={id} fill sizes={sizes ?? "(max-width: 768px) 100vw, 720px"} className="object-cover" />
      </div>
    );
  }

  return (
    <div className={`quote-image overflow-hidden ${className}`}>
      {/* A pasted URL is outside the media library, so next/image cannot
          optimise it and alt text has to be supplied by the person pasting. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
    </div>
  );
}

export function Letterhead({ quotation }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-paper-line pb-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
          <LogoMark />
        </span>
        <div>
          <p className="font-display text-[19px] font-bold leading-none text-paper-text">YaadiGo</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-paper-text-faint">
            {REGISTRATION?.legalName ?? "Travel"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper-text-faint">
          Quotation
        </p>
        <p className="font-mono text-[12px] font-bold text-paper-text">
          v{quotation.version}
        </p>
        {quotation.validUntil && (
          <p className="mt-0.5 font-mono text-[10px] text-paper-text-faint">
            Valid to {quotation.validUntil}
          </p>
        )}
      </div>
    </header>
  );
}

export function AtAGlance({ quotation }) {
  const facts = [
    quotation.durationDays ? [`${quotation.durationDays}`, "days"] : null,
    [`${quotation.travellers}`, quotation.travellers === 1 ? "traveller" : "travellers"],
    quotation.startDate ? [quotation.startDate, "starting"] : null,
    quotation.destination ? [quotation.destination, "where"] : null,
  ].filter(Boolean);

  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-paper-dim p-4 sm:grid-cols-4">
      {facts.map(([value, label]) => (
        <div key={label}>
          <dd className="font-display text-[17px] font-bold leading-tight text-paper-text">
            {value}
          </dd>
          <dt className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
            {label}
          </dt>
        </div>
      ))}
    </dl>
  );
}

/** The day-by-day, at three densities. */
export function Itinerary({ days, density = "cards", images = false }) {
  if (!days?.length) return null;

  if (density === "list") {
    return (
      <section className="mt-6">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
          The plan
        </h2>
        <ol className="mt-2.5 flex flex-col gap-2">
          {days.map((day) => (
            <li key={day.day} className="flex gap-3 text-[13.5px] leading-relaxed">
              <span className="w-[46px] shrink-0 font-mono text-[11px] font-bold text-accent-deep">
                Day {day.day}
              </span>
              <span className="min-w-0 text-paper-text">
                <strong className="font-semibold">{day.title}</strong>
                {day.summary ? ` — ${day.summary}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        Day by day
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {days.map((day) => (
          // break-inside matters: a day card split across a page boundary in
          // print reads as a broken document, not a long one.
          <article
            key={day.day}
            className="overflow-hidden rounded-xl border border-paper-line bg-card print:break-inside-avoid"
          >
            {images && (day.imageId || day.imageUrl) && (
              <QuoteImage
                id={day.imageId}
                url={day.imageUrl}
                alt={day.title}
                className="h-40 w-full sm:h-48"
              />
            )}
            <div className="p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent-deep">
                Day {day.day}
              </p>
              <h3 className="mt-1 font-display text-[16px] font-bold text-paper-text">
                {day.title}
              </h3>
              {day.summary && (
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-paper-text-muted">
                  {day.summary}
                </p>
              )}
              {[day.morning, day.afternoon, day.evening].some(hasContent) && (
                <dl className="mt-2.5 flex flex-col gap-1.5">
                  {[
                    ["Morning", day.morning],
                    ["Afternoon", day.afternoon],
                    ["Evening", day.evening],
                  ]
                    .filter(([, text]) => hasContent(text))
                    .map(([label, text]) => (
                      <div key={label} className="flex gap-2.5 text-[12.5px] leading-relaxed">
                        <dt className="w-[62px] shrink-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                          {label}
                        </dt>
                        <dd className="min-w-0 text-paper-text-muted">{text}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Hotels({ hotels, detailed = false }) {
  if (!hotels?.length) return null;

  return (
    <section className="mt-6">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        Where you stay
      </h2>
      <div className={`mt-3 ${detailed ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-1.5"}`}>
        {hotels.map((hotel, i) => (
          <div
            key={i}
            className={
              detailed
                ? "overflow-hidden rounded-xl border border-paper-line bg-card print:break-inside-avoid"
                : "flex justify-between gap-3 text-[13px]"
            }
          >
            {detailed && (hotel.imageId || hotel.imageUrl) && (
              <QuoteImage
                id={hotel.imageId}
                url={hotel.imageUrl}
                alt={hotel.name}
                className="h-36 w-full"
              />
            )}
            {detailed ? (
              <div className="p-3.5">
                <p className="text-[14px] font-bold text-paper-text">{hotel.name}</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">
                  {[hotel.city, hotel.nights ? `${hotel.nights} nights` : null, hotel.roomType]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {hotel.note && (
                  <p className="mt-1.5 text-[12.5px] leading-snug text-paper-text-muted">
                    {hotel.note}
                  </p>
                )}
              </div>
            ) : (
              <>
                <span className="text-paper-text">{hotel.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-paper-text-faint">
                  {[hotel.city, hotel.nights ? `${hotel.nights}N` : null].filter(Boolean).join(" · ")}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      {/* Stated up front rather than buried in terms — a substituted hotel is
          the single most common complaint, and saying so here prevents it. */}
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-paper-text-faint">
        Hotels named are indicative. If one is unavailable we substitute the same standard or
        better, and tell you before confirming.
      </p>
    </section>
  );
}

export function Flights({ flights }) {
  if (!flights?.length) return null;

  return (
    <section className="mt-6">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        Flights
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {flights.map((flight, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-paper-line bg-card print:break-inside-avoid"
          >
            <div className="p-3.5">
              <p className="text-[13.5px] font-semibold text-paper-text">{flight.route}</p>
              <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">
                {[flight.airline, flight.date, flight.time].filter(Boolean).join(" · ")}
              </p>
            </div>
            {(flight.imageId || flight.imageUrl) && (
              <QuoteImage
                id={flight.imageId}
                url={flight.imageUrl}
                alt={flight.route}
                className="h-auto max-h-64 w-full border-t border-paper-line"
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-paper-text-faint">
        Fares are not held until ticketed. If the fare moves between now and ticketing we tell you
        first — nothing is charged without your approval.
      </p>
    </section>
  );
}

export function Costing({ quotation }) {
  /**
   * Per person is shown on EVERY template, not as a template choice.
   *
   * It used to sit behind a `perPersonSplit` flag that Simple did not pass,
   * so the one-page quotation showed a group total and nothing else. "Kitna
   * per person?" is the first question an Indian traveller asks and the
   * number they compare against every other quote they are holding — making
   * them divide ₹1,24,425 by three themselves is a needless obstacle on the
   * template meant to be the quickest to read.
   *
   * Hidden for a solo traveller, where it would just restate the total.
   */
  const showPerPerson = Number(quotation.travellers) > 1 && quotation.perPerson > 0;
  const kindLabel = (kind) => QUOTE_LINE_KINDS.find((k) => k.value === kind)?.label ?? "Other";

  return (
    <section className="mt-6 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        What it costs
      </h2>

      <div className="mt-2.5 overflow-hidden rounded-xl border border-paper-line">
        {quotation.lines?.map((line, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 border-b border-paper-line px-4 py-2.5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-paper-text">{line.label}</p>
              <p className="mt-0.5 font-mono text-[10px] text-paper-text-faint">
                {kindLabel(line.kind)}
                {line.quantity > 1 ? ` · ×${line.quantity}` : ""}
                {line.perPerson ? " · per person" : " · for the group"}
              </p>
              {line.detail && (
                <p className="mt-1 text-[12px] leading-snug text-paper-text-muted">{line.detail}</p>
              )}
            </div>
            <span className="shrink-0 text-[13.5px] font-semibold text-paper-text">
              {money(line.amount)}
            </span>
          </div>
        ))}
      </div>

      <dl className="mt-3 rounded-xl bg-paper-dim p-4 text-[13.5px]">
        <div className="flex justify-between py-1">
          <dt className="text-paper-text-muted">Subtotal</dt>
          <dd className="font-semibold text-paper-text">{money(quotation.subtotal)}</dd>
        </div>
        {quotation.discount > 0 && (
          <div className="flex justify-between py-1">
            <dt className="text-paper-text-muted">Discount</dt>
            <dd className="font-semibold text-good">− {money(quotation.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between py-1">
          <dt className="text-paper-text-muted">GST {quotation.taxPercent}%</dt>
          <dd className="font-semibold text-paper-text">{money(quotation.tax)}</dd>
        </div>
        <div className="mt-1 flex justify-between border-t border-paper-line pt-2">
          <dt className="font-bold text-paper-text">
            Total for {quotation.travellers} {quotation.travellers === 1 ? "person" : "people"}
          </dt>
          <dd className="font-display text-[20px] font-bold text-accent-deep">
            {money(quotation.total)}
          </dd>
        </div>
        {showPerPerson && (
          <div className="flex justify-between pt-1">
            <dt className="text-paper-text-faint">
              Per person × {quotation.travellers}
            </dt>
            <dd className="font-bold text-paper-text">{money(quotation.perPerson)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function IncludedExcluded({ quotation }) {
  if (!quotation.inclusions?.length && !quotation.exclusions?.length) return null;

  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2 print:break-inside-avoid">
      {quotation.inclusions?.length > 0 && (
        <section>
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-good">Included</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {quotation.inclusions.map((item) => (
              <li key={item} className="text-[13px] leading-snug text-paper-text">
                · {item}
              </li>
            ))}
          </ul>
        </section>
      )}
      {quotation.exclusions?.length > 0 && (
        <section>
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Not included
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {quotation.exclusions.map((item) => (
              <li key={item} className="text-[13px] leading-snug text-paper-text-muted">
                · {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function Payment({ quotation, content, compact = false }) {
  const rows = paymentSchedule(quotation.total, content?.paymentSchedule, quotation.travellers);

  if (compact) {
    const first = rows[0];
    return (
      <section className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-4 print:break-inside-avoid">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent-deep">
          To confirm
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-paper-text">
          <strong className="font-bold">{money(first.amount)}</strong> holds your booking. The
          balance is due before departure.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        Payment
      </h2>
      <div className="mt-2.5 overflow-hidden rounded-xl border border-paper-line">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-paper-line px-4 py-2.5 last:border-b-0"
          >
            <div>
              <p className="text-[13px] font-semibold text-paper-text">{row.label}</p>
              <p className="font-mono text-[10px] text-paper-text-faint">
                {/* A flat per-person advance has no percentage, and printing
                    "undefined%" next to a sum of money is the sort of detail
                    that costs a booking. */}
                {row.when}
                {row.percent ? ` · ${row.percent}%` : ""}
              </p>
            </div>
            <span className="shrink-0 text-[13.5px] font-semibold text-paper-text">
              {money(row.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* How the money can actually be sent.
          A customer who has decided to pay and then cannot find out HOW is the
          most expensive kind of lost booking — they were already convinced. */}
      {content?.paymentOptions?.length > 0 && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {content.paymentOptions.map((option) => (
            <div key={option.label} className="rounded-xl bg-paper-dim px-3.5 py-3">
              <p className="text-[12px] font-bold text-paper-text">{option.label}</p>
              {(option.lines ?? []).map((line) => (
                <p key={line} className="mt-0.5 text-[11.5px] leading-relaxed text-paper-text-muted">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Cancellation({ content }) {
  if (!content?.cancellation?.length) return null;
  return (
    <section className="mt-6 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        If you need to cancel
      </h2>
      <div className="mt-2.5 flex flex-col gap-1">
        {content.cancellation.map((row, i) => (
          <div key={i} className="flex justify-between gap-4 text-[12.5px]">
            <span className="text-paper-text-muted">{row.window}</span>
            <span className="shrink-0 font-semibold text-paper-text">{row.charge}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowToBook({ content }) {
  const steps = content?.howToBook ?? [];
  if (!steps.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-4 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent-deep">
        How to book
      </h2>
      <ol className="mt-2.5 flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-paper-text">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <span className="min-w-0">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Terms({ content, full = false }) {
  const list = content?.termsList ?? [];
  if (!list.length) return null;

  return (
    <section className="mt-6">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        Terms
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {(full ? list : list.slice(0, 3)).map((term) => (
          <li key={term} className="text-[11.5px] leading-relaxed text-paper-text-faint">
            · {term}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mt-8 border-t border-paper-line pt-5">
      <p className="text-[12px] leading-relaxed text-paper-text-muted">
        Questions about anything here?
        {CONTACT?.phone ? ` Call ${CONTACT.phone}.` : ""}
        {CONTACT?.email ? ` Write to ${CONTACT.email}.` : ""}
      </p>
      {/* Only rendered when it exists — a placeholder GSTIN on a document that
          looks like a tax invoice is worse than none. */}
      {(REGISTRATION?.gstin || ADDRESS?.line1) && (
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-paper-text-faint">
          {[REGISTRATION?.legalName, ADDRESS?.line1, ADDRESS?.city, REGISTRATION?.gstin ? `GSTIN ${REGISTRATION.gstin}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </footer>
  );
}

/**
 * What to pack.
 *
 * On the brochure this is a grid of icons; here it is a plain checklist,
 * because a quotation is read on a phone and printed on A4, and neither place
 * is improved by sixteen illustrations. The information is the point — a
 * traveller who reaches Kaza without a power bank does not care that the icon
 * was charming.
 *
 * Trip-specific by default: a Spiti packing list and a Kerala one share almost
 * nothing, and a generic list is one nobody reads twice.
 */
export function ThingsToCarry({ content }) {
  const items = content?.thingsToCarry ?? [];
  if (items.length === 0) return null;

  return (
    <section className="mt-6 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        What to carry
      </h2>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-[12.5px] text-paper-text-muted">
            <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-deep" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Photographs of what they are buying — rooms and vehicles.
 *
 * The caption carries the honest qualifier the brochure uses: "or similar,
 * subject to availability". Showing a specific room and then substituting it
 * is the single most common complaint in Indian package travel, and the
 * sentence that prevents the argument costs nothing to print.
 */
export function Gallery({ title, note, images }) {
  const shots = (images ?? []).filter((image) => image?.id || image?.url);
  if (shots.length === 0) return null;

  return (
    <section className="mt-6 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        {title}
      </h2>
      {note ? <p className="mt-1 text-[11.5px] text-paper-text-faint">{note}</p> : null}
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shots.map((image, i) => (
          <QuoteImage
            key={image.id ?? image.url ?? i}
            id={image.id}
            url={image.url}
            alt={image.alt ?? title}
            className="h-24 w-full rounded-xl sm:h-28"
            sizes="(max-width: 640px) 50vw, 220px"
          />
        ))}
      </div>
    </section>
  );
}

/**
 * What you will actually see.
 *
 * The gap between a price sheet and something a family says yes to. A
 * quotation that lists "Day 3: Gulmarg" tells a traveller nothing about
 * whether they want to go; a photograph of the Gondola with two lines about
 * what it is does.
 *
 * This is the block an Indian traveller reads FIRST and forwards to whoever
 * else is deciding — which is why it sits above the price rather than below
 * it. Price answers "can we afford this". Attractions answer "do we want it",
 * and nobody gets to the first question without the second.
 *
 * Each highlight is optional-image on purpose: a named attraction with an
 * honest line of description still earns its place, and waiting for
 * photography would mean shipping nothing.
 */
export function Highlights({ highlights, title = "What you will see" }) {
  const items = (highlights ?? []).filter((h) => h?.title);
  if (items.length === 0) return null;

  const withImages = items.filter((h) => h.imageId || h.imageUrl).length;

  return (
    <section className="mt-6 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        {title}
      </h2>

      {/* Two columns when there are pictures to show, one when it is text —
          a bare list reads better full width than stranded in a grid. */}
      <div className={`mt-2.5 ${withImages > 0 ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-2"}`}>
        {items.map((item, i) => (
          <div
            key={item.title ?? i}
            className={
              withImages > 0
                ? "overflow-hidden rounded-xl border border-paper-line bg-card print:break-inside-avoid"
                : "rounded-xl border border-paper-line bg-card px-3.5 py-2.5 print:break-inside-avoid"
            }
          >
            {withImages > 0 && (item.imageId || item.imageUrl) ? (
              <QuoteImage
                id={item.imageId}
                url={item.imageUrl}
                alt={item.title}
                className="h-32 w-full"
                sizes="(max-width: 640px) 100vw, 320px"
              />
            ) : null}
            <div className={withImages > 0 && (item.imageId || item.imageUrl) ? "px-3.5 py-2.5" : ""}>
              <p className="text-[13.5px] font-bold text-paper-text">{item.title}</p>
              {item.detail ? (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-paper-text-muted">
                  {item.detail}
                </p>
              ) : null}
              {item.note ? (
                <p className="mt-1 font-mono text-[10.5px] text-paper-text-faint">{item.note}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Who is asking for the money.
 *
 * An Indian traveller about to transfer ₹1.2 lakh to a company they found
 * online is, reasonably, asking who these people are. A quotation that never
 * says is a quotation competing on price alone.
 *
 * Everything here comes from `lib/site.js` and renders only if it is actually
 * set — no invented founding year, no "10,000 happy travellers", no awards.
 * A fabricated credential is worse than a missing one, because the customer
 * who checks and finds nothing stops believing the price too.
 *
 * The registration numbers matter more than anything else in this block for a
 * corporate booker, and they are currently null. Until they are filled in the
 * block simply omits them.
 */
export function AboutUs({ owner }) {
  const address = formattedAddress();
  const credentials = [
    REGISTRATION?.gstin ? `GSTIN ${REGISTRATION.gstin}` : null,
    REGISTRATION?.cin ? `CIN ${REGISTRATION.cin}` : null,
  ].filter(Boolean);

  return (
    <section className="mt-6 rounded-2xl border border-paper-line bg-card px-4 py-3.5 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        Who you are booking with
      </h2>

      <p className="mt-1.5 text-[13px] font-bold text-paper-text">{ORG_LEGAL_NAME}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
        We run fixed-departure group tours and build customised private trips, and we operate a
        corporate travel desk. Every trip is arranged by us directly — the hotels, the transport
        and the day-by-day — so there is one company answerable for it, not a chain of agents.
      </p>

      {/* A named human with a mobile number. "Our support team" means nobody,
          and this is the cheapest trust signal available to us. */}
      {owner?.name ? (
        <p className="mt-2 text-[12.5px] text-paper-text">
          <span className="text-paper-text-muted">Your trip is handled by</span>{" "}
          <span className="font-bold">{owner.name}</span>
          {owner.phone ? (
            <>
              {" · "}
              <a href={`tel:${owner.phone}`} className="font-bold text-accent-deep">
                {owner.phone}
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-0.5 font-mono text-[10.5px] text-paper-text-faint">
        {address ? <span>{address.join(", ")}</span> : null}
        {CONTACT?.phone || CONTACT?.email ? (
          <span>{[CONTACT.phone, CONTACT.email].filter(Boolean).join(" · ")}</span>
        ) : null}
        {credentials.length ? <span>{credentials.join(" · ")}</span> : null}
      </div>
    </section>
  );
}

/** The route, as a single image. A map says in one glance what seven days of prose cannot. */
export function RouteMap({ content }) {
  if (!content?.routeMapId && !content?.routeMapUrl) return null;

  return (
    <section className="mt-6 print:break-inside-avoid">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        The route
      </h2>
      <QuoteImage
        id={content.routeMapId}
        url={content.routeMapUrl}
        alt="Route map for this trip"
        className="mt-2.5 h-56 w-full rounded-2xl sm:h-72"
        sizes="(max-width: 768px) 100vw, 720px"
      />
    </section>
  );
}

/**
 * The declaration.
 *
 * Long, legal, and deliberately LAST — a quotation is a sales document first,
 * and a wall of liability text above the price is how a customer stops reading.
 * It prints on its own page.
 *
 * Only rendered when the business has supplied it. An empty declaration
 * section implies a waiver that does not exist, which is worse than none.
 */
export function Declaration({ content }) {
  const text = content?.declaration;
  if (!text) return null;

  return (
    <section className="mt-8 border-t border-paper-line pt-5 print:break-before-page">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
        Declaration
      </h2>
      <p className="mt-2 text-[11.5px] leading-relaxed text-paper-text-muted">
        By confirming this booking you accept the terms below.
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {String(text)
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para, i) => (
            <p key={i} className="text-[10.5px] leading-relaxed text-paper-text-faint">
              {para.trim()}
            </p>
          ))}
      </div>
    </section>
  );
}
