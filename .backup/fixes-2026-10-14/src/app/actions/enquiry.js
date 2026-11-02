"use server";

import { createBookingRequest } from "@/lib/cms/bookings";
import { joinWaitlist } from "@/lib/cms/seats";
// Importing the CRM entry point registers the notification subscribers before
// the first event is emitted — see lib/crm/index.js.
import "@/lib/crm";
import { captureLead } from "@/lib/crm/leads";

// Handles every enquiry the public site collects (trip builder + contact
// page). Runs on the server, so it is also the only place that needs to know
// how a lead actually reaches a human.

const MAX_LENGTHS = {
  name: 120,
  phone: 24,
  email: 160,
  destination: 200,
  dates: 120,
  message: 2000,
  company: 160,
  role: 120,
  // An AI-planner itinerary travels as JSON alongside the lead. Generous but
  // bounded — a 21-day plan is comfortably under this.
  itinerary: 60000,
};

const BUDGET_BANDS = [
  "Under ₹25,000",
  "₹25,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "Above ₹1,00,000",
];

const INTERESTS = ["Adventure", "Relaxation", "Culture & heritage", "Pilgrimage", "Wildlife"];

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

// Deliberately permissive: Indian numbers get written every possible way
// (+91, 0-prefixed, spaced, hyphenated) and rejecting a real lead over
// formatting costs more than accepting an odd-looking one.
function looksLikePhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function validate(formData) {
  const errors = {};

  const name = clean(formData.get("name"), MAX_LENGTHS.name);
  if (name.length < 2) errors.name = "Please tell us your name.";

  const phone = clean(formData.get("phone"), MAX_LENGTHS.phone);
  const email = clean(formData.get("email"), MAX_LENGTHS.email);

  // At least one way to reach them back. Phone is what the desk actually
  // uses, so it is required on the trip builder; the contact form allows
  // either by marking phone optional in the markup.
  if (!phone && !email) {
    errors.phone = "Add a phone number or an email so we can reply.";
  } else {
    if (phone && !looksLikePhone(phone)) errors.phone = "That phone number doesn't look right.";
    if (email && !looksLikeEmail(email)) errors.email = "That email address doesn't look right.";
  }

  const interests = formData
    .getAll("interests")
    .filter((i) => INTERESTS.includes(i));

  const budget = clean(formData.get("budget"), 40);

  // The planner posts the whole generated itinerary so the desk quotes what
  // the traveller actually saw. Unparseable JSON is dropped, never fatal —
  // losing the attachment must not lose the lead.
  let itinerary = null;
  const itineraryRaw = clean(formData.get("itinerary"), MAX_LENGTHS.itinerary);
  if (itineraryRaw) {
    try {
      const parsed = JSON.parse(itineraryRaw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.days)) {
        itinerary = {
          title: parsed.title,
          destination: parsed.destination,
          durationDays: parsed.durationDays,
          estimatedCostPerPerson: parsed.estimatedCostPerPerson,
          days: parsed.days,
        };
      }
    } catch {
      console.warn("[enquiry] itinerary attachment was not valid JSON — dropped");
    }
  }

  // Corporate leads carry a couple of extra qualifying fields. They are
  // optional everywhere else, so leisure forms are unaffected.
  const company = clean(formData.get("company"), MAX_LENGTHS.company) || null;
  const role = clean(formData.get("role"), MAX_LENGTHS.role) || null;
  const monthlyTripsRaw = Number.parseInt(formData.get("monthlyTrips"), 10);
  const monthlyTrips = Number.isFinite(monthlyTripsRaw)
    ? Math.min(Math.max(monthlyTripsRaw, 0), 100000)
    : null;

  const groupSizeRaw = Number.parseInt(formData.get("groupSize"), 10);
  const groupSize = Number.isFinite(groupSizeRaw)
    ? Math.min(Math.max(groupSizeRaw, 1), 999)
    : null;

  return {
    errors,
    enquiry: {
      name,
      phone: phone || null,
      email: email || null,
      destination: clean(formData.get("destination"), MAX_LENGTHS.destination) || null,
      dates: clean(formData.get("dates"), MAX_LENGTHS.dates) || null,
      groupSize,
      budget: BUDGET_BANDS.includes(budget) ? budget : null,
      interests,
      company,
      role,
      monthlyTrips,
      message: clean(formData.get("message"), MAX_LENGTHS.message) || null,
      itinerary,
      source: clean(formData.get("source"), 40) || "unknown",
      receivedAt: new Date().toISOString(),
    },
    // Only the fixed-departure panel sends these. Carried separately from the
    // enquiry so the lead record stays the same shape on every form.
    selection: clean(formData.get("bookingTripSlug"), 80)
      ? {
          tripSlug: clean(formData.get("bookingTripSlug"), 80),
          departureId: clean(formData.get("bookingDepartureId"), 80),
          sharingId: clean(formData.get("bookingSharingId"), 80),
          pickupId: clean(formData.get("bookingPickupId"), 80),
          travellers: groupSize ?? 1,
          // A sold-out batch (or a trip with no dates yet) — join its
          // waitlist instead of requesting seats that do not exist.
          waitlist: formData.get("waitlist") === "1",
        }
      : null,
  };
}

/**
 * Where a lead goes.
 *
 * Three places, deliberately, in order of reliability:
 *   1. The record store, so it appears in the admin inbox. This is the one
 *      that must not fail — a lead that only exists in a log line is a lead
 *      nobody works.
 *   2. The server log, as a structured line, so it survives even if the store
 *      is on an ephemeral filesystem.
 *   3. The webhook, if configured.
 *
 * Storing happens FIRST and its failure is reported, because everything else
 * is a copy.
 */
async function deliver(enquiry, selection) {
  const url = process.env.ENQUIRY_WEBHOOK_URL;

  // 1. Into the inbox. Failing this is worth telling the visitor about,
  //    because it is the copy the business actually works from.
  // captureLead assigns an owner, writes the record AND emits lead.created,
  // which is what fans out to the desk, the admin and the customer. Writing
  // the record directly here would leave the pipeline silent.
  const lead = await captureLead(enquiry);

  // 1b. A seat request also becomes a booking, so the desk works it from the
  //     bookings board rather than re-reading a paragraph of text. Seats are
  //     NOT held yet — that happens when the desk confirms. Failing here must
  //     not fail the enquiry: the lead is already safe, and a booking that did
  //     not record is recoverable from it.
  if (selection?.waitlist) {
    try {
      await joinWaitlist({
        tripSlug: selection.tripSlug,
        departureId: selection.departureId || null,
        travellers: selection.travellers,
        name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email,
        leadId: lead.id,
      });
    } catch (error) {
      // The lead is already safe; the waitlist entry is recoverable from it.
      console.error("[enquiry] could not record the waitlist entry", error);
    }
  } else if (selection) {
    try {
      const booking = await createBookingRequest({
        ...selection,
        leadId: lead.id,
        contact: { name: enquiry.name, phone: enquiry.phone, email: enquiry.email },
      });
      if (!booking) {
        console.warn("[enquiry] booking selection did not resolve to a live batch", selection);
      }
    } catch (error) {
      console.error("[enquiry] could not record the booking request", error);
    }
  }

  // 2. Always log the enquiry as one structured line, so it survives in the
  //    host's logs (Vercel, etc.) even if the store or webhook is unavailable.
  //    A full itinerary would bury the log line, so that is summarised here —
  //    the webhook below still receives it in full.
  console.info(
    "[enquiry]",
    JSON.stringify({
      ...enquiry,
      itinerary: enquiry.itinerary
        ? `${enquiry.itinerary.title} (${enquiry.itinerary.days.length} days)`
        : null,
    })
  );

  // 3. Forward to a CRM / Zapier / n8n endpoint if one is configured.
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ENQUIRY_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.ENQUIRY_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(enquiry),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Enquiry webhook responded ${res.status}`);
  }
}

export async function submitEnquiry(_prevState, formData) {
  // Honeypot: a hidden field real people never fill. Bots do. Return the same
  // success shape so the bot has nothing to learn from the difference.
  if (clean(formData.get("company_website"), 200)) {
    return { status: "success" };
  }

  const { errors, enquiry, selection } = validate(formData);

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors, values: enquiry };
  }

  try {
    await deliver(enquiry, selection);
  } catch (error) {
    console.error("[enquiry] delivery failed", error);
    return {
      status: "error",
      message:
        "We couldn't send that just now. Please try again, or write to us directly.",
      values: enquiry,
    };
  }

  return { status: "success" };
}
