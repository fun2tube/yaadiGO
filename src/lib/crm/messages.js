/**
 * What the desk actually sends.
 *
 * NOT the WhatsApp Business API. These produce a `wa.me` deep link that opens
 * the salesperson's own WhatsApp with the message already typed — which needs
 * no credentials, no template approval and no Meta review, and is how a small
 * desk actually works. The Business API is for automated sending and comes
 * later; this works today.
 *
 * Why templates at all: the button used to open a blank chat, so every
 * salesperson wrote their own opener. Quality varied by person and by mood,
 * nothing was consistent, and the slowest part of a follow-up was deciding how
 * to word it.
 *
 * Deliberately browser-safe — no `server-only` — because the lead screen and
 * the booking screen both render these as buttons.
 *
 * House style, which these follow: no "Dear Sir/Madam", no exclamation marks,
 * no emoji wall. Name the trip, say the one thing, make the next step obvious.
 * Indian travellers get enough shouty marketing.
 */

import { money } from "@/lib/crm/schema";

const firstName = (name) => String(name ?? "").trim().split(/\s+/)[0] || "there";

/**
 * The library. `when` is the situation, not the lead stage, because the same
 * message is right in more than one stage.
 */
export const MESSAGE_TEMPLATES = [
  {
    id: "first-contact",
    label: "First contact",
    when: "A new enquiry, before you have spoken",
    build: ({ lead, me }) =>
      `Hello ${firstName(lead?.name)}, this is ${firstName(me?.name)} from YaadiGo. Thanks for your enquiry about ${lead?.destination ?? "your trip"}.\n\nI can put together a day-by-day plan with costs. Two quick things — roughly which dates, and how many of you travelling?`,
  },
  {
    id: "missed-call",
    label: "After a missed call",
    when: "You rang and they did not pick up",
    build: ({ lead, me }) =>
      `Hello ${firstName(lead?.name)}, ${firstName(me?.name)} from YaadiGo — I tried calling about your ${lead?.destination ?? "trip"} enquiry. Reply here whenever suits and I will work around you.`,
  },
  {
    id: "itinerary-sent",
    label: "Itinerary shared",
    when: "You have sent a plan but not a price",
    build: ({ lead, me }) =>
      `${firstName(lead?.name)}, I have drafted a day-by-day for ${lead?.destination ?? "your trip"} and sent it across. Have a read and tell me what you would change — happy to swap hotels, add a day or cut one.\n\n— ${firstName(me?.name)}, YaadiGo`,
  },
  {
    id: "quote-sent",
    label: "Quotation sent",
    when: "A quotation is ready",
    needs: ["quotation"],
    build: ({ lead, quotation, me, url }) =>
      `${firstName(lead?.name)}, your quotation for ${quotation?.title ?? "the trip"} is ready — ${money(quotation?.total)} for ${quotation?.travellers ?? ""} ${quotation?.travellers === 1 ? "person" : "people"}.\n\nIt has the full day-by-day, what is included and what is not: ${url ?? ""}\n\nYou can accept it on that page, or tell me what to change.\n\n— ${firstName(me?.name)}, YaadiGo`,
  },
  {
    id: "quote-chase",
    label: "Quotation follow-up",
    when: "Sent a few days ago, no reply",
    needs: ["quotation"],
    build: ({ lead, quotation, me, url }) =>
      `${firstName(lead?.name)}, just checking you saw the quotation for ${quotation?.title ?? "your trip"} — ${money(quotation?.total)}.\n\nIf the price or the plan is not quite right, say so and I will rework it rather than let it sit. ${url ?? ""}\n\n— ${firstName(me?.name)}`,
  },
  {
    id: "seats-low",
    label: "Seats running low",
    when: "Their batch is nearly full",
    build: ({ lead, quotation, me }) =>
      `${firstName(lead?.name)}, a heads-up — the batch we discussed for ${quotation?.title ?? lead?.destination ?? "your trip"} is down to its last few seats. No pressure, but if you are leaning towards it, worth confirming this week.\n\n— ${firstName(me?.name)}, YaadiGo`,
  },
  {
    id: "payment-link",
    label: "Payment link",
    when: "They have said yes",
    needs: ["booking", "url"],
    build: ({ booking, amount, me, url }) =>
      `Here is the secure payment link for ${booking?.tripTitle ?? "your trip"} — ${money(amount ?? booking?.total)}.\n\n${url ?? ""}\n\nUPI, card or net banking all work. Booking reference ${booking?.reference ?? ""}.\n\n— ${firstName(me?.name)}, YaadiGo`,
  },
  {
    id: "balance-due",
    label: "Balance reminder",
    when: "Advance paid, balance outstanding",
    needs: ["booking"],
    build: ({ booking, amount, me, url }) =>
      `${firstName(booking?.name)}, the balance on ${booking?.tripTitle ?? "your booking"} is ${money(amount)}, due before departure.\n\n${url ? `${url}\n\n` : ""}Reference ${booking?.reference ?? ""}. Anything you need before then, just ask.\n\n— ${firstName(me?.name)}, YaadiGo`,
  },
  {
    id: "pre-departure",
    label: "Pre-departure",
    when: "A week before they travel",
    needs: ["booking"],
    build: ({ booking, me }) =>
      `${firstName(booking?.name)}, you are off to ${booking?.tripTitle ?? "your trip"} soon. Everything is confirmed at our end.\n\nI will send your vouchers and the full day-by-day shortly. Our 24×7 number is in there — use it any time while you are travelling, not just in an emergency.\n\n— ${firstName(me?.name)}, YaadiGo`,
  },
  {
    id: "welcome-back",
    label: "Welcome back + review",
    when: "They are home",
    needs: ["booking"],
    build: ({ booking, me }) =>
      `${firstName(booking?.name)}, welcome back. Hope ${booking?.tripTitle ?? "the trip"} was everything you wanted.\n\nIf you have two minutes, a review genuinely helps us — and if anything fell short, I would rather hear it directly.\n\n— ${firstName(me?.name)}, YaadiGo`,
  },
];

export function messageTemplate(id) {
  return MESSAGE_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Which templates make sense right now.
 *
 * Showing all ten on every screen would make the useful one hard to find, so a
 * template whose `needs` are not satisfied is not offered.
 */
export function templatesFor({ lead, quotation, booking } = {}) {
  const have = { lead: Boolean(lead), quotation: Boolean(quotation), booking: Boolean(booking), url: true };
  return MESSAGE_TEMPLATES.filter((t) => (t.needs ?? []).every((need) => have[need]));
}

/**
 * Render a template to text.
 *
 * Returns plain text, not a link, so the same string can go to WhatsApp, to
 * email, or onto the clipboard.
 */
export function renderMessage(id, context = {}) {
  const template = messageTemplate(id);
  if (!template) return null;
  return template.build(context).replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * A `wa.me` link with the message pre-typed.
 *
 * Digits only with the country code — wa.me silently fails on a `+`, spaces or
 * dashes, and "silently" is the problem: the salesperson sees WhatsApp open on
 * a blank search and assumes the customer has no WhatsApp.
 *
 * A bare 10-digit Indian number gets 91 prefixed. Anything else is passed
 * through, because it may already carry a country code.
 */
export function whatsappTo(phone, message) {
  let digits = String(phone ?? "").replace(/\D/g, "");

  // India's trunk prefix. People write 098765 43210 constantly, and wa.me
  // rejects it — a caught test case, not a hypothetical.
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length < 10) return null;

  const number = digits.length === 10 ? `91${digits}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${number}${text}`;
}

/** The same message as a mailto, for customers who gave an email and no phone. */
export function mailTo(email, subject, message) {
  if (!email) return null;
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (message) params.set("body", message);
  const query = params.toString();
  return `mailto:${email}${query ? `?${query}` : ""}`;
}
