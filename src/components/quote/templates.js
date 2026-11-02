import {
  Letterhead,
  AtAGlance,
  Itinerary,
  Hotels,
  Flights,
  Costing,
  IncludedExcluded,
  Payment,
  Cancellation,
  ThingsToCarry,
  Gallery,
  RouteMap,
  Declaration,
  HowToBook,
  Terms,
  Footer,
  QuoteImage,
  Highlights,
  AboutUs,
} from "@/components/quote/blocks";
import { templateMeta } from "@/lib/crm/quote-content";

/**
 * The three templates.
 *
 * Each one composes the SAME blocks in a different order and density. Nothing
 * here computes a figure, formats a price or restates a policy — that all
 * lives in blocks.js, so switching template cannot change a number. Three
 * hand-written costing tables would drift, and the one that drifts is the one a
 * customer holds you to.
 */

function Title({ quotation, content }) {
  return (
    <>
      <h1 className="mt-5 font-display text-[28px] font-bold leading-tight tracking-tight text-paper-text sm:text-[34px]">
        {quotation.title}
      </h1>
      {(content?.overview || quotation.summary) && (
        <p className="mt-2.5 text-[15px] leading-relaxed text-paper-text">
          {content?.overview || quotation.summary}
        </p>
      )}
    </>
  );
}

/**
 * SIMPLE — one page, price first.
 *
 * No hero, no day images. For a repeat customer or someone who has already
 * decided: decoration slows a decision that is already made, and a second page
 * of pictures is a second page they have to scroll past to find the number.
 */
function Simple({ quotation, content, children }) {
  return (
    <>
      <Letterhead quotation={quotation} />
      <Title quotation={quotation} content={content} />
      <AtAGlance quotation={quotation} />
      <Costing quotation={quotation} />
      <Itinerary days={quotation.itinerary?.days} density="list" />
      <Hotels hotels={content?.hotels} />
      <IncludedExcluded quotation={quotation} />
      <Payment quotation={quotation} content={content} compact />
      {/* Cancellation appears in EVERY template, not just Detailed.
          A template chooses how much of the trip to show; it must never
          choose which obligations the customer is told about. Simple and
          Modern were going out with payment terms and no cancellation
          terms — so when somebody cancelled, nothing had been agreed. */}
      <Cancellation content={content} />
      <HowToBook content={content} />
      {children}
      <Terms content={content} />
      <AboutUs owner={content?.owner} />
      <Footer />
    </>
  );
}

/**
 * MODERN — the everyday quotation.
 *
 * Hero image, day cards, full payment schedule. Persuasive without being a
 * brochure. The itinerary comes BEFORE the price: a first-time enquirer should
 * see what they are buying before what it costs.
 */
function Modern({ quotation, content, children }) {
  return (
    <>
      <Letterhead quotation={quotation} />

      {(content?.heroImageId || content?.heroImageUrl) && (
        <QuoteImage
          id={content.heroImageId}
          url={content.heroImageUrl}
          alt={quotation.destination ?? quotation.title}
          className="mt-5 h-52 w-full rounded-2xl sm:h-72"
          sizes="(max-width: 768px) 100vw, 720px"
        />
      )}

      <Title quotation={quotation} content={content} />
      <AtAGlance quotation={quotation} />
      <Highlights highlights={content?.highlights} />
      <Itinerary days={quotation.itinerary?.days} density="cards" />
      <Hotels hotels={content?.hotels} />
      <Flights flights={content?.flights} />
      <Costing quotation={quotation} />
      <IncludedExcluded quotation={quotation} />
      {/* Modern stays deliberately lean — galleries, packing list and the
          declaration belong to Detailed. Three templates that all show
          everything are one template with three stylesheets. */}
      <Payment quotation={quotation} content={content} />
      <Cancellation content={content} />
      <HowToBook content={content} />
      {children}
      <Terms content={content} />
      <AboutUs owner={content?.owner} />
      <Footer />
    </>
  );
}

/**
 * DETAILED — for the big trips.
 *
 * Everything, including per-day images, hotel photos, flight screenshots and
 * the full cancellation schedule. For a customer being asked for ₹2,00,000+,
 * who needs to feel the operator has thought it through.
 */
function Detailed({ quotation, content, children }) {
  return (
    <>
      <Letterhead quotation={quotation} />

      {(content?.heroImageId || content?.heroImageUrl) && (
        <QuoteImage
          id={content.heroImageId}
          url={content.heroImageUrl}
          alt={quotation.destination ?? quotation.title}
          className="mt-5 h-60 w-full rounded-2xl sm:h-80"
          sizes="(max-width: 768px) 100vw, 720px"
        />
      )}

      <Title quotation={quotation} content={content} />
      <AtAGlance quotation={quotation} />
      <Highlights highlights={content?.highlights} />
      <RouteMap content={content} />
      <Itinerary days={quotation.itinerary?.days} density="cards" images />
      <Hotels hotels={content?.hotels} detailed />
      <Flights flights={content?.flights} />
      <Costing quotation={quotation} />
      <IncludedExcluded quotation={quotation} />
      <ThingsToCarry content={content} />

      {/* Rooms and vehicles, in brochure order. The honest qualifier is on the
          stay gallery because substituting a hotel is the single most common
          complaint in Indian package travel — the sentence that prevents the
          argument costs nothing to print. */}
      <Gallery
        title="Where you stay"
        note="Or similar, subject to availability on your dates."
        images={content?.stayPhotos}
      />
      <Gallery title="How you travel" images={content?.transportPhotos} />

      <Payment quotation={quotation} content={content} />
      <Cancellation content={content} />
      <HowToBook content={content} />
      {children}
      <Terms content={content} full />
      <AboutUs owner={content?.owner} />
      <Declaration content={content} />
      <Footer />
    </>
  );
}

const BY_TEMPLATE = { simple: Simple, modern: Modern, detailed: Detailed };

/**
 * Render a quotation in its chosen template.
 *
 * `children` is where the approve/decline control goes on the customer-facing
 * page, and nothing on the staff preview — so the same component serves both.
 */
export default function QuotationDocument({ quotation, content, children }) {
  const template = templateMeta(content?.template ?? "modern").value;
  const Template = BY_TEMPLATE[template] ?? Modern;

  return (
    <article className={`quote-doc quote-${template}`}>
      <Template quotation={quotation} content={content}>
        {children}
      </Template>
    </article>
  );
}
