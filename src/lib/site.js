// Central place for the site's own identity — swap SITE_URL for the real
// production domain when this deploys.
export const SITE_URL = "https://www.yaadigo.com";
export const SITE_NAME = "YaadiGo";
export const ORG_LEGAL_NAME = "YaadiGo Networks Pvt Ltd";

// The "For Corporate" landing page. Relative on purpose: corporate.yaadigo.com
// has no DNS yet, so an absolute link went nowhere. src/proxy.js leaves
// /corporate alone on the subdomain too, so this works on both hosts.
export const CORPORATE_URL = "/corporate";

// ---------------------------------------------------------------------------
// Business details.
//
// Anything still `null` here is a real-world fact nobody has supplied yet, so
// it is NOT invented and NOT rendered — the footer, contact page and
// Organization schema all skip null fields rather than printing a placeholder.
// Fill these in and the UI picks them up everywhere at once.
// ---------------------------------------------------------------------------
export const CONTACT = {
  // Known from the Corporate Travel Desk page.
  corporateEmail: "corporate@yaadigo.in",

  // The general enquiry address — the one nominated for notifications and
  // admin.
  email: "info@yaadigo.in",

  // One number for calls and WhatsApp. Three formats because three jobs:
  // reading, dialling, and a wa.me deep link (digits only, country code, no +).
  phone: "+91 73737 34778",
  phoneHref: "+917373734778",
  whatsapp: "917373734778",
};

export const ADDRESS = {
  // TODO: fill in from the CIN certificate before launch.
  street: "Kalkaji",
  locality: "New Delhi",
  region: "Delhi",
  postalCode: null,     // e.g. "560001"
  country: "IN",
};

export const REGISTRATION = {
  // TODO: fill in before launch — these belong on About and in the footer for
  // an Indian Pvt Ltd, and a corporate client's finance team will look for them.
  cin: null,            // Corporate Identity Number
  gstin: null,          // GST registration number
};

export const SOCIAL = {
  // Paste the profile URLs here and they appear in the footer, in the
  // Organization schema as `sameAs`, and anywhere the site links out.
  instagram: null,      // e.g. "https://www.instagram.com/yaadigo"
  youtube: null,        // e.g. "https://www.youtube.com/@yaadigo"
  facebook: null,
};

/**
 * Video the site shows, by social post URL.
 *
 * Why URLs rather than uploaded files: the trips are already being filmed for
 * Instagram and YouTube, and asking the desk to export and upload a second
 * copy for the website is the step that never happens. Paste the post link and
 * it plays here too — produce once, publish three places, which is exactly
 * what the content plan asks for.
 *
 * `trip` keys a video to a trip slug so it appears on that trip page.
 * Everything with no trip shows on the homepage reel.
 */
export const VIDEOS = [
  // { url: "https://www.instagram.com/reel/XXXX/", title: "Spiti in October", trip: "spiti-valley-circuit" },
  // { url: "https://www.youtube.com/watch?v=XXXX", title: "Ladakh high passes" },
];
// Shown on /privacy and /terms. Bump when the policy text actually changes.
export const LEGAL_LAST_UPDATED = "25 September 2026";

/** Address as an array of display lines, or null if nothing is filled in yet. */
export function formattedAddress() {
  const parts = [
    ADDRESS.street,
    ADDRESS.locality,
    [ADDRESS.region, ADDRESS.postalCode].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.length ? parts : null;
}

/** Non-null social profile URLs, for schema.org `sameAs`. */
export function socialProfiles() {
  return Object.values(SOCIAL).filter(Boolean);
}

/**
 * A wa.me deep link with the message pre-typed, or null when no number is
 * configured. Callers fall back to /contact on null.
 */
export function whatsappLink(message) {
  if (!CONTACT.whatsapp) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${CONTACT.whatsapp}${text}`;
}

/** Where a "quick enquiry" button should point, WhatsApp configured or not. */
export function quickEnquiryHref(message) {
  return whatsappLink(message) ?? "/contact#enquire";
}
