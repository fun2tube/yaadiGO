"use client";

import { useState } from "react";
import BookingPanel from "./booking/booking-panel";
import Img from "./img";
import { getImage } from "@/lib/media";
import { quickEnquiryHref, whatsappLink } from "@/lib/site";
import Link from "next/link";
import { CalendarIcon, UsersIcon, CheckIcon, AlertIcon, ChevronIcon, WhatsAppIcon } from "./icons";

// The first day starts open. By position, not by `day.day === 1`: trips edited
// in the admin store day numbers as text ("1", or "1–2"), so that check left
// every managed trip's itinerary fully closed (found 2026-11-03 comparing pages
// before and after moving the coded trips into the database).
function ItineraryDay({ day, first = false }) {
  const [open, setOpen] = useState(first);
  return (
    <div className="border-b border-paper-line py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-[12px] font-semibold text-accent-deep">
            {day.day}
          </span>
          <span className="text-[14.5px] font-semibold text-paper-text">{day.title}</span>
        </span>
        <ChevronIcon size={16} dir={open ? "down" : "right"} className="text-paper-text-faint" />
      </button>
      {open && (
        <p className="mt-2.5 pl-10 text-[13.5px] leading-relaxed text-paper-text-muted">
          {day.detail}
        </p>
      )}
    </div>
  );
}

export default function TourDetail({ tour, related }) {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        {getImage(tour.coverImageId || tour.slug) && (
          <>
            <Img
              id={tour.coverImageId || tour.slug}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-45"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-ink/55" />
          </>
        )}
        <div
          className="h-56 w-full sm:h-72"
          style={{
            background: "#2C3340",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pb-8 pt-6 sm:px-10">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12px] text-ink-text-faint">
            <Link href="/group-tours" className="hover:text-ink-text">Group Tours</Link>
            <ChevronIcon size={10} />
            <span className="truncate text-ink-text-muted">{tour.title}</span>
          </nav>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-text-faint">
            {tour.destination}
          </span>
          <h1 className="mt-1 font-display text-[30px] font-medium text-ink-text sm:text-[36px]">
            {tour.title}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-ink-text-faint">
            <span className="flex items-center gap-1.5">
              <CalendarIcon size={14} /> {tour.duration} · Next departure {tour.nextDeparture}
            </span>
            <span className="flex items-center gap-1.5">
              <UsersIcon size={14} /> {tour.seatsLeft} seats left
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 sm:px-10 lg:flex-row lg:items-start lg:gap-14">
        <div className="min-w-0 flex-1">
          <section>
            <h2 className="font-display text-[20px] font-medium text-paper-text">
              Day-by-day itinerary
            </h2>
            <div className="mt-3">
              {tour.itinerary.map((day, index) => (
                <ItineraryDay key={day.day} day={day} first={index === 0} />
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 font-display text-[18px] font-medium text-paper-text">
                <CheckIcon size={17} color="var(--color-good)" /> Inclusions
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {tour.inclusions.map((item) => (
                  <li key={item} className="flex gap-2 text-[13.5px] leading-relaxed text-paper-text-muted">
                    <CheckIcon size={14} color="var(--color-good)" className="mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-display text-[18px] font-medium text-paper-text">
                <AlertIcon size={16} color="var(--color-brass)" /> Exclusions
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {tour.exclusions.map((item) => (
                  <li key={item} className="text-[13.5px] leading-relaxed text-paper-text-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-[18px] font-medium text-paper-text">
              Questions people ask before booking
            </h2>
            <div className="mt-3 flex flex-col divide-y divide-paper-line">
              {tour.faq.map((item) => (
                <details key={item.q} className="group py-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-medium text-paper-text">
                    {item.q}
                    <ChevronIcon size={14} className="text-paper-text-faint transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-paper-text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {related.length > 0 && (
            <section className="mt-12 border-t border-paper-line pt-8">
              <h2 className="font-display text-[18px] font-medium text-paper-text">
                Other tours you might like
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/group-tours/${r.slug}`}
                    className="rounded-xl border border-paper-line p-4 transition-colors hover:border-paper-line-strong"
                  >
                    <span className="text-[11.5px] font-semibold uppercase tracking-wide text-paper-text-faint">
                      {r.destination}
                    </span>
                    <h3 className="mt-1 text-[14.5px] font-medium text-paper-text">{r.title}</h3>
                    <span className="mt-2 block font-display text-[15px] font-medium text-paper-text">
                      ₹{r.price.toLocaleString("en-IN")}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="w-full flex-shrink-0 lg:sticky lg:top-24 lg:w-[380px]">
          <BookingPanel tour={tour} />

          <a
            href={quickEnquiryHref(
              `Hi, I'd like to know more about ${tour.title} (${tour.nextDeparture})`
            )}
            {...(whatsappLink("") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-paper-line-strong px-5 py-3 text-[13.5px] font-semibold text-paper-text transition-colors hover:border-accent"
          >
            <WhatsAppIcon size={16} /> Ask about this trip
          </a>
        </aside>
      </div>
    </>
  );
}
