/**
 * The pipeline, in one file.
 *
 * Every stage name, transition and label the CRM uses lives here rather than
 * being retyped in a route, a component and a metric. A status that exists in
 * the UI but not in the reducer is the classic way these systems rot, and the
 * KPI screen is the place it shows up first — as a stage that silently counts
 * zero forever.
 *
 * Safe to import from the browser: no server-only dependencies.
 */

// ---------------------------------------------------------------------------
// People, and what they are allowed to touch
// ---------------------------------------------------------------------------

/**
 * Modules are the unit an admin actually thinks in: "Priya does leads and
 * quotations, not operations." Permissions are the unit the code checks. This
 * list is the bridge, so the team screen can render checkboxes without
 * hard-coding a permission string in a component.
 */
export const MODULES = [
  {
    key: "leads",
    label: "Leads",
    blurb: "See enquiries, work them, change stage, add notes.",
    read: "leads.read",
    write: "leads.write",
  },
  {
    key: "quotations",
    label: "Quotations",
    blurb: "Build, price and send quotations.",
    read: "quotations.read",
    write: "quotations.write",
  },
  {
    key: "bookings",
    label: "Bookings",
    blurb: "Confirm bookings and record payments.",
    read: "bookings.read",
    write: "bookings.write",
  },
  {
    // Its own module, not a corner of Bookings.
    //
    // Issuing a tax invoice used to need `bookings.write`, which every
    // salesperson and every manager holds — so the person who negotiated the
    // price could also raise the statutory document for it. That is a control
    // weakness rather than a convenience, and separating it is the whole
    // reason the accounts role exists.
    key: "invoices",
    label: "Invoices & accounts",
    blurb: "Raise tax invoices, reconcile payments, handle refunds.",
    read: "invoices.read",
    write: "invoices.write",
  },
  {
    key: "operations",
    label: "Operations",
    blurb: "Arrange flights, hotels, cabs and the day-by-day timeline.",
    read: "bookings.read",
    write: "services.write",
  },
  {
    key: "catalogue",
    label: "Trips & destinations",
    blurb: "Departures, seats, prices and which trips are listed.",
    read: "catalogue.read",
    write: "catalogue.write",
  },
  {
    key: "content",
    label: "Website content",
    blurb: "Edit text, images and styling on the live site.",
    read: "content.read",
    write: "content.write",
  },
  {
    key: "reports",
    label: "Reports",
    blurb: "Pipeline, revenue and per-person performance.",
    read: "reports.read",
    write: null,
  },
  {
    key: "team",
    label: "Team",
    blurb: "Invite people, approve them, change what they can do.",
    read: "team.read",
    write: "team.write",
  },
];

export const ALL_PERMISSIONS = [
  ...new Set(MODULES.flatMap((m) => [m.read, m.write]).filter(Boolean)),
];

/**
 * Roles are PRESETS, not cages.
 *
 * A role seeds someone's permissions when they are invited; an admin can then
 * tick or untick individual modules. Storing the resolved permissions on the
 * user — rather than deriving them from the role at check time — means
 * changing the preset later cannot silently widen access for people who were
 * already approved.
 */
export const ROLES = {
  admin: {
    value: "admin",
    label: "Admin",
    blurb: "Everything, including the team and the website.",
    permissions: ["*"],
  },
  sales: {
    value: "sales",
    label: "Sales",
    blurb: "Leads, quotations, bookings and payments.",
    permissions: [
      "leads.read",
      "leads.write",
      "quotations.read",
      "quotations.write",
      "bookings.read",
      "bookings.write",
      "catalogue.read",
      "reports.read",
    ],
  },
  ops: {
    value: "ops",
    label: "Operations",
    blurb: "Confirmed bookings, suppliers and the travel timeline.",
    // quotations.read added 2026-10-14: ops needs to see what the customer
    // was promised (the register and the quotation itself). Read-only; the
    // register hides cost and margin from anyone without team.read.
    permissions: ["bookings.read", "services.write", "catalogue.read", "leads.read", "quotations.read"],
  },
  /**
   * Accounts.
   *
   * Records what happened; does not decide it. No access to leads or
   * quotations at all — the separation only means something if the person
   * raising the invoice could not also have changed the price on it.
   *
   * Bookings are read-only for the same reason: accounts needs to see what
   * was sold to invoice it, and must not be able to alter the figure.
   */
  accounts: {
    value: "accounts",
    label: "Accounts",
    blurb: "Invoices, payments and refunds. Cannot change a lead or a price.",
    permissions: ["invoices.read", "invoices.write", "bookings.read", "reports.read"],
  },
  manager: {
    value: "manager",
    label: "Manager",
    blurb: "Everything operational, plus reports — but not the team or the site.",
    permissions: [
      "leads.read",
      "leads.write",
      "quotations.read",
      "quotations.write",
      "bookings.read",
      "bookings.write",
      "services.write",
      "catalogue.read",
      "catalogue.write",
      "reports.read",
      // Read, deliberately not write. A manager can see every invoice and
      // chase one that is missing; raising it stays with accounts, or the
      // separation above is cosmetic.
      "invoices.read",
    ],
  },
};

export const ROLE_VALUES = Object.keys(ROLES);

export function permissionsForRole(role) {
  return [...(ROLES[role]?.permissions ?? [])];
}

/**
 * The single authority on "may this person do that".
 *
 * Takes the user, not the role, because permissions are per person. A
 * suspended or not-yet-approved account is refused here rather than at each
 * call site, so forgetting the status check is not possible.
 */
export function userCan(user, permission) {
  if (!user || user.status !== "active") return false;
  const granted = user.permissions ?? [];
  if (granted.includes("*")) return true;
  return granted.includes(permission);
}

/**
 * Whose bookings this person sees: `null` for everyone's, or their own user id.
 *
 * Leads were scoped to their owner; bookings were not, so a salesperson
 * opened Bookings and saw every colleague's customers and phone numbers
 * (review 2026-10-14-full-function-test, F6). People whose work spans the
 * whole desk — managers and admins (`team.read`), operations
 * (`services.write`) and accounts (`invoices.read`) — see all of them.
 */
export function bookingScope(user) {
  if (!user) return "nobody";
  if (userCan(user, "team.read") || userCan(user, "services.write") || userCan(user, "invoices.read")) {
    return null;
  }
  return user.id;
}

export function canSeeBooking(user, booking) {
  const scope = bookingScope(user);
  if (scope === null) return true;
  return Boolean(booking) && booking.salesOwnerId === scope;
}

/** Filter a list of bookings down to what this person may see. */
export function visibleBookings(user, bookings) {
  const scope = bookingScope(user);
  if (scope === null) return bookings;
  return bookings.filter((b) => b.salesOwnerId === scope);
}

/** Which modules to show this person in the navigation. */
export function modulesFor(user) {
  return MODULES.filter((m) => userCan(user, m.read) || (m.write && userCan(user, m.write)));
}

/**
 * Account lifecycle.
 *
 * `invited` and `pending` are deliberately separate. Invited means a link was
 * sent and nothing exists yet; pending means a real person set a password and
 * is waiting on a human. Collapsing them hides the queue an admin has to work.
 */
export const USER_STATUSES = [
  { value: "invited", label: "Invited", tone: "neutral", canSignIn: false },
  { value: "pending", label: "Awaiting approval", tone: "warn", canSignIn: false },
  { value: "active", label: "Active", tone: "good", canSignIn: true },
  { value: "suspended", label: "Suspended", tone: "danger", canSignIn: false },
];

export const USER_STATUS_VALUES = USER_STATUSES.map((s) => s.value);

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

/**
 * `open` marks the stages that still need someone to act. It drives the "my
 * work today" counts, and it is the reason `quoted` is open but `won` is not —
 * a won lead has become a booking and is worked from there instead.
 */
export const LEAD_STAGES = [
  { value: "new", label: "New", open: true, tone: "accent", hint: "Nobody has called yet" },
  { value: "contacted", label: "Contacted", open: true, tone: "neutral", hint: "Spoken to, gathering requirements" },
  { value: "qualified", label: "Qualified", open: true, tone: "neutral", hint: "Real budget and real dates" },
  { value: "quoted", label: "Quoted", open: true, tone: "warn", hint: "Quotation sent, awaiting a decision" },
  { value: "negotiating", label: "Negotiating", open: true, tone: "warn", hint: "Reworking price or itinerary" },
  { value: "won", label: "Won", open: false, tone: "good", hint: "Converted to a booking" },
  { value: "lost", label: "Lost", open: false, tone: "danger", hint: "Not proceeding" },
];

export const LEAD_STAGE_VALUES = LEAD_STAGES.map((s) => s.value);
export const OPEN_LEAD_STAGES = LEAD_STAGES.filter((s) => s.open).map((s) => s.value);

/**
 * What happened on the call.
 *
 * Free-text notes made this unmeasurable: there was no way to answer "how many
 * dials does a booking take", and nothing distinguished "called, not
 * interested" from "called, nobody picked up". Both read as a note.
 *
 * `nextDays` is the point. A salesperson under time pressure does not set a
 * follow-up date, so the outcome sets it — one tap logs what happened AND when
 * to try again. The outcomes that deliberately set nothing are the ones where
 * a date would be a lie: a wrong number has nobody to call, and "not
 * interested" needs a human decision, not a reminder.
 */
export const CALL_OUTCOMES = [
  {
    value: "connected",
    label: "Spoke to them",
    nextDays: 3,
    tone: "good",
    hint: "Move the stage on as well",
  },
  {
    value: "no-answer",
    label: "No answer",
    nextDays: 1,
    tone: "warn",
    hint: "Try again tomorrow",
  },
  {
    value: "busy",
    label: "Asked to call later",
    nextDays: 1,
    tone: "warn",
  },
  {
    value: "callback",
    label: "Callback booked",
    nextDays: null,
    needsDate: true,
    tone: "accent",
    hint: "Their date, not ours",
  },
  {
    value: "wrong-number",
    label: "Wrong number",
    nextDays: null,
    tone: "danger",
    hint: "No follow-up set — find another contact",
  },
  {
    value: "not-interested",
    label: "Not interested",
    nextDays: null,
    suggestsLost: true,
    tone: "danger",
    hint: "Mark it lost with a reason",
  },
];

export const CALL_OUTCOME_VALUES = CALL_OUTCOMES.map((o) => o.value);

export function callOutcome(value) {
  return CALL_OUTCOMES.find((o) => o.value === value) ?? null;
}

/** Why a lead was lost — a free-text box here produces unusable reporting. */
export const LOST_REASONS = [
  "Price too high",
  "Booked elsewhere",
  "Dates did not work",
  "Plan postponed",
  "No response",
  "Not a genuine enquiry",
  "Other",
];

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

export const QUOTE_STATUSES = [
  { value: "draft", label: "Draft", tone: "neutral", customerVisible: false },
  { value: "sent", label: "Sent", tone: "warn", customerVisible: true },
  { value: "approved", label: "Approved", tone: "good", customerVisible: true },
  { value: "rejected", label: "Rejected", tone: "danger", customerVisible: true },
  { value: "expired", label: "Expired", tone: "neutral", customerVisible: true },
  { value: "superseded", label: "Superseded", tone: "neutral", customerVisible: false },
];

export const QUOTE_STATUS_VALUES = QUOTE_STATUSES.map((s) => s.value);

/** What a quotation is made of. Mirrors how a travel desk actually costs a trip. */
export const QUOTE_LINE_KINDS = [
  { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" },
  { value: "transport", label: "Transport" },
  { value: "activity", label: "Activity" },
  { value: "meal", label: "Meals" },
  { value: "guide", label: "Guide" },
  { value: "permit", label: "Permits & fees" },
  { value: "insurance", label: "Insurance" },
  { value: "service", label: "Service charge" },
  { value: "other", label: "Other" },
];

export const QUOTE_LINE_KIND_VALUES = QUOTE_LINE_KINDS.map((k) => k.value);

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * Two doors into the same pipeline: a fixed departure reserved on the website,
 * and a customised quotation the customer approved. They differ in where the
 * money and the itinerary come from, not in how they are then worked.
 */
export const BOOKING_SOURCES = [
  { value: "fixed-departure", label: "Fixed departure" },
  { value: "quotation", label: "Customised" },
];

export const BOOKING_STAGES = [
  { value: "requested", label: "Requested", tone: "accent", holdsSeats: false, team: "sales" },
  { value: "confirmed", label: "Confirmed", tone: "warn", holdsSeats: true, team: "sales" },
  { value: "part-paid", label: "Part paid", tone: "warn", holdsSeats: true, team: "sales" },
  { value: "paid", label: "Paid in full", tone: "good", holdsSeats: true, team: "ops" },
  { value: "in-progress", label: "Travelling", tone: "good", holdsSeats: true, team: "ops" },
  { value: "completed", label: "Completed", tone: "neutral", holdsSeats: true, team: "ops" },
  { value: "cancelled", label: "Cancelled", tone: "danger", holdsSeats: false, team: "sales" },
];

export const BOOKING_STAGE_VALUES = BOOKING_STAGES.map((s) => s.value);

/** Stages in which seats are deducted from a fixed departure. */
export function bookingHoldsSeats(status) {
  return BOOKING_STAGES.find((s) => s.value === status)?.holdsSeats ?? false;
}

/** Whose queue a booking sits in right now. */
export function bookingTeam(status) {
  return BOOKING_STAGES.find((s) => s.value === status)?.team ?? "sales";
}

// ---------------------------------------------------------------------------
// Operations — the things a trip is actually made of
// ---------------------------------------------------------------------------

export const SERVICE_KINDS = [
  { value: "flight", label: "Flight", needsRef: true, refLabel: "PNR" },
  { value: "hotel", label: "Hotel", needsRef: true, refLabel: "Confirmation no." },
  { value: "cab", label: "Cab / transfer", needsRef: false, refLabel: "Vendor ref" },
  { value: "train", label: "Train", needsRef: true, refLabel: "PNR" },
  { value: "activity", label: "Activity", needsRef: false, refLabel: "Voucher" },
  { value: "guide", label: "Guide", needsRef: false, refLabel: "Contact" },
  { value: "permit", label: "Permit", needsRef: true, refLabel: "Permit no." },
  { value: "other", label: "Other", needsRef: false, refLabel: "Reference" },
];

export const SERVICE_KIND_VALUES = SERVICE_KINDS.map((k) => k.value);

export const SERVICE_STATUSES = [
  { value: "todo", label: "To arrange", tone: "accent" },
  { value: "requested", label: "Requested", tone: "warn" },
  { value: "confirmed", label: "Confirmed", tone: "good" },
  { value: "cancelled", label: "Cancelled", tone: "danger" },
];

export const SERVICE_STATUS_VALUES = SERVICE_STATUSES.map((s) => s.value);

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = [
  "UPI",
  "Bank transfer",
  "Card",
  "Cash",
  "Cheque",
  "Payment link",
  "Wallet",
];

export const PAYMENT_KINDS = [
  { value: "advance", label: "Advance" },
  { value: "instalment", label: "Instalment" },
  { value: "balance", label: "Balance" },
  { value: "refund", label: "Refund" },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/**
 * Every event the system tells someone about.
 *
 * `audience` is who hears it, not who caused it. Keeping this as data rather
 * than scattered calls means a new channel (WhatsApp, push) is wired once and
 * every existing event flows through it.
 */
export const NOTIFICATION_EVENTS = {
  // A booking was cancelled or a hold released on a batch with people on its
  // waitlist. Sales and admin, because whoever is free should ring the first
  // person in line before the seat is sold to someone else.
  "departure.seat_freed": { audience: ["admin", "sales"], title: "A seat came free on a waitlisted departure" },
  "lead.created": {
    audience: ["admin", "sales", "customer"],
    title: "New enquiry",
    customerTitle: "We have your enquiry",
  },
  // A second enquiry from someone already in the pipeline. The owner hears
  // about it because it is a buying signal; nobody else needs to.
  // Demand intelligence, not a callable lead — logged, nobody notified. A ping
  // for every chat about Kashmir would bury the notifications that matter.
  "interest.captured": { audience: [], title: "Someone asked Yaadi about a trip" },
  "lead.repeat": { audience: ["owner"], title: "A lead enquired again" },
  // Logged for reporting, notified to nobody. A salesperson recording "no
  // answer" must not ping the team — that is how notification panels get
  // ignored, and then the ones that matter get ignored with them.
  "lead.call": { audience: [], title: "Call logged" },
  // Same reasoning as lead.call: it belongs on the timeline so the next
  // person can see what was agreed, but a brief is edited several times
  // during one phone call and a notification per edit buries everything else.
  "lead.brief": { audience: [], title: "Trip brief updated" },
  // Logged so the library can be traced back to who built each entry.
  // Nobody is notified: saving a template is housekeeping, not news.
  "quotation.templated": { audience: [], title: "Quotation saved to the library" },
  // The owner first — most of the time they are simply busy, and going
  // straight to the manager teaches the team that the system tells on them.
  "lead.sla.nudge": { audience: ["owner"], title: "A new lead has not been called" },
  // After a working day it is capacity or absence, not forgetfulness, so
  // somebody with the authority to reassign it needs to know.
  "lead.sla.escalated": {
    audience: ["owner", "admin"],
    title: "A lead has gone a day without contact",
  },
  "lead.assigned": { audience: ["owner"], title: "A lead was assigned to you" },
  "lead.stage": { audience: ["owner", "admin"], title: "Lead stage changed" },
  "quotation.sent": {
    audience: ["admin", "customer"],
    title: "Quotation sent",
    customerTitle: "Your quotation is ready",
  },
  "quotation.reminder": {
    audience: ["customer"],
    title: "Reminder sent",
    customerTitle: "About your quotation",
  },
  "quotation.cold": {
    audience: ["owner"],
    title: "A quotation has gone quiet",
  },
  "quotation.expired": {
    audience: ["owner"],
    title: "A quotation expired",
  },
  "quotation.approved": {
    audience: ["owner", "admin"],
    title: "Quotation approved",
  },
  "quotation.rejected": { audience: ["owner", "admin"], title: "Quotation declined" },
  // Logged, nobody notified: discarding your own unsent draft is housekeeping.
  "quotation.discarded": { audience: [], title: "A draft was discarded" },
  "booking.created": {
    audience: ["admin", "sales", "customer"],
    title: "New booking",
    customerTitle: "Your booking is registered",
  },
  // A quotation approved on a lead that already had a booking: the booking's
  // money changed, no new booking was made (convert.js, one booking per lead).
  "booking.updated": { audience: ["owner"], title: "Booking updated from an approved quotation" },
  "booking.confirmed": {
    audience: ["ops", "customer"],
    title: "Booking confirmed",
    customerTitle: "Your booking is confirmed",
  },
  "booking.paid": { audience: ["ops", "admin"], title: "Booking paid in full" },
  "booking.handover": { audience: ["ops"], title: "Booking handed to operations" },
  "payment.received": { audience: ["owner", "admin"], title: "Payment received" },
  // The customer is the only audience that matters here — the link is for them,
  // and the salesperson just asked for it, so telling them is noise.
  "payment.link.sent": {
    audience: ["customer"],
    title: "Payment link sent",
    customerTitle: "Your payment link",
  },
  // A failed payment is an emergency for the desk: the customer intended to pay
  // and could not, and nobody will chase it unless somebody is told.
  "payment.failed": {
    audience: ["owner", "admin", "customer"],
    title: "A payment failed",
    customerTitle: "That payment did not go through",
  },
  "service.confirmed": { audience: ["owner"], title: "A service was confirmed" },
  "departure.soon": { audience: ["ops"], title: "Departure approaching" },
};

export const NOTIFICATION_EVENT_VALUES = Object.keys(NOTIFICATION_EVENTS);

// ---------------------------------------------------------------------------
// Helpers shared by every screen
// ---------------------------------------------------------------------------

export function money(value, currency = "INR") {
  const n = Number(value ?? 0);
  if (currency === "INR") return `₹${n.toLocaleString("en-IN")}`;
  return `${currency} ${n.toLocaleString("en-IN")}`;
}

export function stageMeta(list, value) {
  return list.find((s) => s.value === value) ?? list[0];
}

/** Tailwind classes per tone, so a status pill looks the same everywhere. */
export const TONE_CLASSES = {
  accent: "bg-accent/15 text-accent-deep",
  neutral: "bg-paper-line-strong text-paper-text-muted",
  warn: "bg-warn/20 text-warn",
  good: "bg-good/15 text-good",
  danger: "bg-danger/10 text-danger",
};
