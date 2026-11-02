import {
  pgTable,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
  check,
  date,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

/**
 * The database.
 *
 * REVISED 2026-09-29. The first version of this file was written before the
 * CRM modules existed, and then the modules were built differently. Every
 * table had drifted — `stage` vs `status`, money named three ways, `invoices`
 * missing entirely. An adapter papering over that would have baked the drift
 * in permanently, so the schema was rewritten against what the code actually
 * stores. Cheap to do with no production data; expensive later.
 *
 * Three rules survive from the original, because each one earns its place:
 *
 *   MONEY IS INTEGER PAISE. Never a float, never a JS number in the database.
 *   `0.1 + 0.2 !== 0.3`, and a desk that rounds wrong on a ₹2,40,000 booking
 *   has an argument with a customer it cannot win.
 *
 *   THE DATABASE ENFORCES THE INVARIANTS. Seats cannot go negative because of
 *   a CHECK constraint, not because the application remembered to look. The
 *   application will eventually forget; Postgres will not.
 *
 *   EVERY ROW KNOWS ITS CHAIN. leadId / quotationId / bookingId are threaded
 *   through so a report can answer "revenue from AI-planner enquiries" with
 *   one filter instead of reassembling relationships at read time.
 *
 * One rule is NEW, and it is why the column names below match the modules:
 *
 *   THE SCHEMA FOLLOWS THE CODE. Renaming a field at the storage boundary
 *   means a mapping layer, and a mapping layer is where fields get silently
 *   dropped — exactly how `unitCost` vanished and every quotation reported
 *   100% margin.
 */

// ---------------------------------------------------------------------------
// Enums — mirrored in lib/crm/schema.js, which the UI reads
// ---------------------------------------------------------------------------

// `accounts` was missing: the app offers an Accounts role (lib/crm/schema.js),
// and inviting one would have been refused by Postgres (found 2026-10-14).
export const roleEnum = pgEnum("role", ["admin", "manager", "sales", "ops", "accounts"]);

export const userStatusEnum = pgEnum("user_status", [
  "invited",
  "pending",
  "active",
  "suspended",
]);

export const leadStageEnum = pgEnum("lead_stage", [
  "new",
  "contacted",
  "qualified",
  "quoted",
  "negotiating",
  "won",
  "lost",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "approved",
  "rejected",
  "expired",
  "superseded",
]);

/**
 * Seven stages, not five.
 *
 * The old `BOOKING_STATUSES` list in lib/cms/bookings.js has five and the API
 * validates against it, while `recordPayment` sets `part-paid` — a value that
 * list would reject. That is backlog #7 and this enum is the correct list;
 * the JS constant is what has to move.
 */
export const bookingStageEnum = pgEnum("booking_stage", [
  "requested",
  "confirmed",
  "part-paid",
  "paid",
  "in-progress",
  "completed",
  "cancelled",
]);

export const serviceKindEnum = pgEnum("service_kind", [
  "flight",
  "hotel",
  "cab",
  "train",
  "activity",
  "guide",
  "permit",
  "other",
]);

export const serviceStatusEnum = pgEnum("service_status", [
  "todo",
  "requested",
  "confirmed",
  "cancelled",
]);

export const paymentKindEnum = pgEnum("payment_kind", [
  "advance",
  "instalment",
  "balance",
  "refund",
]);

export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "queued",
  "sent",
  "failed",
]);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    role: roleEnum("role").notNull().default("sales"),
    status: userStatusEnum("status").notNull().default("invited"),

    // Per user, seeded from the role. Stored rather than derived so changing a
    // preset later cannot silently widen access for people already approved.
    permissions: jsonb("permissions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    passwordHash: text("password_hash"),
    googleId: text("google_id"),

    // Bearer credentials, stored as SHA-256 digests. A leaked backup or a
    // careless log of a user row must not hand out account takeovers.
    inviteTokenHash: text("invite_token_hash"),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    resetTokenHash: text("reset_token_hash"),
    resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true }),

    monthlyTargetPaise: bigint("monthly_target_paise", { mode: "bigint" }),

    // Denormalised names, on purpose: "invited by Priya" must still read
    // correctly after Priya's account is deleted.
    invitedById: text("invited_by_id"),
    invitedByName: text("invited_by_name"),
    approvedById: text("approved_by_id"),
    approvedByName: text("approved_by_name"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Case-insensitive: nobody should register Priya@ alongside priya@ and
    // quietly become a second account for the same person.
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    uniqueIndex("users_google_unique").on(t.googleId).where(sql`${t.googleId} is not null`),
    index("users_status_idx").on(t.status),
  ]
);

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export const leads = pgTable(
  "leads",
  {
    id: id(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    company: text("company"),
    role: text("role"),

    destination: text("destination"),
    dates: text("dates"),
    groupSize: integer("group_size"),
    budget: text("budget"),

    /**
     * The structured brief — see lib/crm/brief.js.
     *
     * `dates`, `groupSize` and `budget` above are kept and still populated by
     * the public forms: they hold what the customer actually typed ("mid-June,
     * flexible", "around 40-50k"), which is worth preserving verbatim. The
     * columns below are what the salesperson confirms, and they are what the
     * system can act on.
     *
     * The scalars are real columns rather than keys inside `brief` because
     * each one has to be queried: a departure date drives the T-21 and T-7
     * reminders, head counts drive pricing, and a budget amount is what makes
     * the pipeline sortable by size. Anything nested — rooms, stays, legs —
     * lives in the jsonb, where nothing needs to filter on it.
     */
    departureDate: date("departure_date"),
    // "Mid-June, flexible" is the most common answer there is, and a bare date
    // cannot hold it. Storing the date anyway is what makes reminders possible;
    // the flag is what stops us treating a guess as a commitment.
    departureFlexible: boolean("departure_flexible").notNull().default(false),
    returnDate: date("return_date"),

    adults: integer("adults"),
    // [{ age }] per child, never a count: two children aged 4 and 11 do not
    // price the same and a count cannot tell them apart.
    children: jsonb("children").$type<{ age: number }[]>().notNull().default(sql`'[]'::jsonb`),
    infants: integer("infants").notNull().default(0),

    budgetAmountPaise: bigint("budget_amount_paise", { mode: "bigint" }),
    budgetPerPerson: boolean("budget_per_person").notNull().default(true),

    brief: jsonb("brief"),
    interests: jsonb("interests").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    message: text("message"),
    monthlyTrips: integer("monthly_trips"),

    // The itinerary the AI planner produced, kept verbatim so the desk quotes
    // exactly what the customer saw.
    itinerary: jsonb("itinerary"),

    source: text("source").notNull().default("unknown"),
    status: leadStageEnum("status").notNull().default("new"),
    lostReason: text("lost_reason"),

    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),

    /**
     * When this lead is next due.
     *
     * The field the entire sales workspace hangs on — "who do I ring today"
     * was unanswerable without it. Indexed because every screen filters on it.
     */
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),

    // Notes are jsonb rather than a child table: they are append-only, always
    // read with the lead, and never queried across leads. A join per row on
    // every list render buys nothing.
    notes: jsonb("notes").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),

    valuePaise: bigint("value_paise", { mode: "bigint" }),
    bookingId: text("booking_id"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    index("leads_status_idx").on(t.status),
    index("leads_owner_idx").on(t.ownerId),
    index("leads_received_idx").on(t.receivedAt),
    index("leads_followup_idx").on(t.followUpAt),
    // The T-21 / T-7 reminder sweep filters on this; without the index it is
    // a full scan every run.
    index("leads_departure_idx").on(t.departureDate),
    // A lost lead must say why, or "why do we lose deals" — the question this
    // data exists to answer — is unanswerable.
    check("leads_lost_needs_reason", sql`${t.status} <> 'lost' or ${t.lostReason} is not null`),
  ]
);

// ---------------------------------------------------------------------------
// Catalogue — fixed departures carry inventory, destinations do not
// ---------------------------------------------------------------------------

export const departures = pgTable(
  "departures",
  {
    id: id(),
    tripSlug: text("trip_slug").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    pricePaise: bigint("price_paise", { mode: "bigint" }).notNull(),

    seatsTotal: integer("seats_total").notNull(),
    // Decremented inside the same transaction that confirms a booking, under
    // a guarded UPDATE — never read-modify-written in JavaScript.
    seatsLeft: integer("seats_left").notNull(),

    published: boolean("published").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("departures_trip_start_unique").on(t.tripSlug, t.startDate),
    index("departures_trip_idx").on(t.tripSlug),
    // The two invariants that stop a batch being oversold.
    check("departures_seats_not_negative", sql`${t.seatsLeft} >= 0`),
    check("departures_seats_within_total", sql`${t.seatsLeft} <= ${t.seatsTotal}`),
    check("departures_ends_after_start", sql`${t.endDate} > ${t.startDate}`),
  ]
);

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

export const quotations = pgTable(
  "quotations",
  {
    id: id(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: quoteStatusEnum("status").notNull().default("draft"),

    title: text("title").notNull(),
    destination: text("destination"),
    durationDays: integer("duration_days"),
    startDate: text("start_date"),
    summary: text("summary"),
    itinerary: jsonb("itinerary"),
    inclusions: jsonb("inclusions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    exclusions: jsonb("exclusions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    terms: text("terms"),

    travellers: integer("travellers").notNull().default(1),

    /**
     * Lines as jsonb rather than a child table.
     *
     * A deliberate reversal of the first schema. They are always read with the
     * quotation, never queried across quotations, and a sent quotation is
     * immutable — so the row IS the snapshot. The CHECK constraints the child
     * table carried (quantity >= 1, price >= 0) are enforced in
     * priceQuotation(), which is also where they have to be anyway, because
     * the totals are derived there.
     */
    lines: jsonb("lines").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),

    // All derived from the lines and recomputed on every write. Stored because
    // a sent quotation must be reproducible exactly as the customer saw it.
    subtotalPaise: bigint("subtotal_paise", { mode: "bigint" }).notNull().default(sql`0`),
    costPaise: bigint("cost_paise", { mode: "bigint" }).notNull().default(sql`0`),
    discountPaise: bigint("discount_paise", { mode: "bigint" }).notNull().default(sql`0`),
    taxPercent: integer("tax_percent").notNull().default(5),
    taxPaise: bigint("tax_paise", { mode: "bigint" }).notNull().default(sql`0`),
    totalPaise: bigint("total_paise", { mode: "bigint" }).notNull().default(sql`0`),
    perPersonPaise: bigint("per_person_paise", { mode: "bigint" }).notNull().default(sql`0`),

    // Nullable on purpose: with no cost data the margin is UNKNOWN, not 100%.
    // A margin nobody entered would tell a salesperson to discount freely.
    grossMarginPaise: bigint("gross_margin_paise", { mode: "bigint" }),
    marginPercent: integer("margin_percent"),

    /**
     * The quotation this one replaced.
     *
     * `reviseQuotation` has always set this and it has always been thrown away,
     * because there was no column to put it in — so the revision chain was
     * lost and nothing could answer "what did v1 say that v3 does not". The
     * same silent-drop that cost us `unitCost` and `itinerary`.
     *
     * `set null` rather than cascade: deleting an old version must not delete
     * the revision that superseded it, which is the live one.
     */
    /**
     * How the quotation is PRESENTED — template, hero image, hotel and flight
     * blocks, packing list, galleries, declaration.
     *
     * `setPresentation` has always written this and it has always been thrown
     * away, because there was no column: a salesperson chose the Detailed
     * template, pressed save, and the customer received the Modern one. The
     * fourth silent drop in this table after `unitCost`, `itinerary` and
     * `revisionOf` — the pattern is writing a field the schema never declared.
     *
     * jsonb rather than columns because it is presentation, not data: it is
     * never queried across quotations and its shape changes whenever a
     * template gains a block.
     */
    content: jsonb("content"),

    revisionOf: text("revision_of").references((): AnyPgColumn => quotations.id, {
      onDelete: "set null",
    }),

    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdById: text("created_by_id"),
    createdByName: text("created_by_name"),

    // The customer's link. Unguessable, and the only authorisation on the
    // public quotation view.
    token: text("token").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    validUntil: text("valid_until"),
    currency: text("currency").notNull().default("INR"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("quotations_token_unique").on(t.token),
    uniqueIndex("quotations_lead_version_unique").on(t.leadId, t.version),
    index("quotations_status_idx").on(t.status),
    index("quotations_owner_idx").on(t.ownerId),
    check("quotations_total_non_negative", sql`${t.totalPaise} >= 0`),
    check("quotations_travellers_positive", sql`${t.travellers} >= 1`),
  ]
);

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    reference: text("reference").notNull(),

    // Two doors into the same pipeline: a fixed departure reserved on the
    // website, and a customised quotation the customer approved.
    source: text("source").notNull(),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
    quotationId: text("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
    departureId: text("departure_id").references(() => departures.id, { onDelete: "restrict" }),
    tripSlug: text("trip_slug"),

    status: bookingStageEnum("status").notNull().default("requested"),

    name: text("name"),
    phone: text("phone"),
    email: text("email"),

    tripTitle: text("trip_title").notNull(),
    travellers: integer("travellers").notNull().default(1),
    departureLabel: text("departure_label"),
    departureStart: text("departure_start"),

    totalPaise: bigint("total_paise", { mode: "bigint" }).notNull().default(sql`0`),
    perPersonPaise: bigint("per_person_paise", { mode: "bigint" }).notNull().default(sql`0`),
    advancePaise: bigint("advance_paise", { mode: "bigint" }).notNull().default(sql`0`),
    balancePaise: bigint("balance_paise", { mode: "bigint" }).notNull().default(sql`0`),
    // Running total, maintained inside the payment write so the board never
    // has to sum a child table to draw a row.
    collectedPaise: bigint("collected_paise", { mode: "bigint" }).notNull().default(sql`0`),

    salesOwnerId: text("sales_owner_id").references(() => users.id, { onDelete: "set null" }),
    opsOwnerId: text("ops_owner_id").references(() => users.id, { onDelete: "set null" }),
    handedToOpsAt: timestamp("handed_to_ops_at", { withTimezone: true }),

    // What operations builds the real service list from.
    itinerary: jsonb("itinerary"),
    inclusions: jsonb("inclusions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    exclusions: jsonb("exclusions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    notes: jsonb("notes").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),

    seatsHeld: integer("seats_held").notNull().default(0),
    seatsLeftAtRequest: integer("seats_left_at_request"),
    sharing: text("sharing"),
    pickup: text("pickup"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bookings_reference_unique").on(t.reference),
    index("bookings_status_idx").on(t.status),
    index("bookings_lead_idx").on(t.leadId),
    index("bookings_sales_owner_idx").on(t.salesOwnerId),
    index("bookings_ops_owner_idx").on(t.opsOwnerId),
    check("bookings_collected_non_negative", sql`${t.collectedPaise} >= 0`),
    // A booking must come from somewhere. An orphan belongs to no pipeline and
    // appears in no report.
    check("bookings_has_origin", sql`${t.leadId} is not null or ${t.departureId} is not null`),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    // Denormalised so the lead's ledger does not join through bookings.
    leadId: text("lead_id"),

    kind: paymentKindEnum("kind").notNull().default("instalment"),
    // Refunds are stored NEGATIVE, so the ledger sums to the truth without the
    // reader having to know which rows to subtract.
    amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
    method: text("method").notNull(),
    reference: text("reference"),
    note: text("note"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),

    recordedById: text("recorded_by_id"),
    recordedByName: text("recorded_by_name"),
    ...timestamps,
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId, t.receivedAt),
    index("payments_lead_idx").on(t.leadId),
    check(
      "payments_refunds_negative",
      sql`(${t.kind} = 'refund' and ${t.amountPaise} < 0) or (${t.kind} <> 'refund' and ${t.amountPaise} > 0)`
    ),
  ]
);

/**
 * Tax invoices.
 *
 * Missing entirely from the first schema — built after it and never added.
 * Everything below `number` is a SNAPSHOT: seller, customer and lines are
 * copied at issue, because a booking edited next month must not silently
 * change an invoice already with the customer.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    number: text("number").notNull(),
    financialYear: text("financial_year").notNull(),
    sequence: integer("sequence").notNull(),

    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    leadId: text("lead_id"),
    quotationId: text("quotation_id"),

    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    issuedById: text("issued_by_id"),
    issuedByName: text("issued_by_name"),

    seller: jsonb("seller").notNull(),
    customer: jsonb("customer").notNull(),
    placeOfSupply: text("place_of_supply"),
    // Added 2026-10-14 (review F3): the state code decides CGST/SGST vs IGST,
    // and a tax invoice states the SAC and the split.
    placeOfSupplyCode: text("place_of_supply_code"),
    sac: text("sac"),
    taxSplit: jsonb("tax_split"),

    title: text("title").notNull(),
    travellers: integer("travellers"),
    travelDates: text("travel_dates"),
    lines: jsonb("lines").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),

    subtotalPaise: bigint("subtotal_paise", { mode: "bigint" }).notNull().default(sql`0`),
    discountPaise: bigint("discount_paise", { mode: "bigint" }).notNull().default(sql`0`),
    taxPercent: integer("tax_percent").notNull().default(5),
    taxPaise: bigint("tax_paise", { mode: "bigint" }).notNull().default(sql`0`),
    totalPaise: bigint("total_paise", { mode: "bigint" }).notNull().default(sql`0`),
    currency: text("currency").notNull().default("INR"),
    ...timestamps,
  },
  (t) => [
    // Gapless and unique per financial year — a duplicate or a gap in an
    // invoice sequence is a compliance question nobody wants to answer.
    uniqueIndex("invoices_number_unique").on(t.number),
    uniqueIndex("invoices_fy_sequence_unique").on(t.financialYear, t.sequence),
    // One invoice per booking. The idempotency in issueInvoice() is the first
    // line of defence; this is the one that cannot be forgotten.
    uniqueIndex("invoices_booking_unique").on(t.bookingId),
    index("invoices_issued_idx").on(t.issuedAt),
  ]
);

/**
 * Credit notes — how an issued invoice is corrected.
 *
 * An invoice is immutable; a mistake or a refund is reversed by a credit note
 * with its own gapless sequence per financial year (`YG/CN/26-27/0001`). The
 * amount is positive and is what is credited; the application refuses more
 * than the invoice still has un-credited.
 */
export const creditNotes = pgTable(
  "credit_notes",
  {
    id: id(),
    number: text("number").notNull(),
    financialYear: text("financial_year").notNull(),
    sequence: integer("sequence").notNull(),

    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    bookingId: text("booking_id"),

    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    issuedById: text("issued_by_id"),
    issuedByName: text("issued_by_name"),
    reason: text("reason").notNull(),

    taxPercent: integer("tax_percent").notNull().default(5),
    taxablePaise: bigint("taxable_paise", { mode: "bigint" }).notNull().default(sql`0`),
    taxPaise: bigint("tax_paise", { mode: "bigint" }).notNull().default(sql`0`),
    totalPaise: bigint("total_paise", { mode: "bigint" }).notNull().default(sql`0`),
    taxSplit: jsonb("tax_split"),
    currency: text("currency").notNull().default("INR"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("credit_notes_number_unique").on(t.number),
    uniqueIndex("credit_notes_fy_sequence_unique").on(t.financialYear, t.sequence),
    index("credit_notes_invoice_idx").on(t.invoiceId),
    check("credit_notes_total_positive", sql`${t.totalPaise} > 0`),
  ]
);

export const bookingServices = pgTable(
  "booking_services",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    kind: serviceKindEnum("kind").notNull(),
    status: serviceStatusEnum("status").notNull().default("todo"),

    title: text("title").notNull(),
    supplier: text("supplier"),
    reference: text("reference"),

    startsAt: text("starts_at"),
    endsAt: text("ends_at"),

    costPaise: bigint("cost_paise", { mode: "bigint" }).notNull().default(sql`0`),
    assignedToId: text("assigned_to_id"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("booking_services_booking_idx").on(t.bookingId, t.startsAt),
    index("booking_services_status_idx").on(t.status),
  ]
);

// ---------------------------------------------------------------------------
// The spine
// ---------------------------------------------------------------------------

/**
 * Append-only. Nothing updates or deletes a row here.
 *
 * Written in the SAME TRANSACTION as the state change it describes, which is
 * what makes reports reconcile: a booking cannot exist without its
 * booking.created event, and an event cannot survive a rolled-back booking.
 */
export const events = pgTable(
  "events",
  {
    id: id(),
    type: text("type").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),

    actorId: text("actor_id"),
    actorName: text("actor_name"),

    // The chain, denormalised so reporting never joins to find it.
    leadId: text("lead_id"),
    quotationId: text("quotation_id"),
    bookingId: text("booking_id"),

    // Ownership AT THE TIME. Ownership changes; history should not.
    ownerId: text("owner_id"),

    amountPaise: bigint("amount_paise", { mode: "bigint" }),
    currency: text("currency").notNull().default("INR"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [
    index("events_at_idx").on(t.at),
    index("events_type_at_idx").on(t.type, t.at),
    index("events_lead_idx").on(t.leadId),
    index("events_booking_idx").on(t.bookingId),
    index("events_owner_at_idx").on(t.ownerId, t.at),
  ]
);

/**
 * Transactional outbox.
 *
 * A side effect — an email, a WhatsApp message — is queued in the same
 * transaction as the change that caused it, and dispatched afterwards by a
 * worker. Without this, a crash between "payment saved" and "customer told"
 * loses the message silently.
 */
export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    channel: text("channel").notNull(),
    to: text("to").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    event: text("event"),

    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    reason: text("reason"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),

    leadId: text("lead_id"),
    bookingId: text("booking_id"),
    ...timestamps,
  },
  (t) => [
    index("outbox_status_idx").on(t.status, t.nextAttemptAt),
    index("outbox_created_idx").on(t.createdAt),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    read: boolean("read").notNull().default(false),
    leadId: text("lead_id"),
    bookingId: text("booking_id"),
    ...timestamps,
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read, t.createdAt)]
);

/** Site content overrides — the inline CMS. */
export const contentOverrides = pgTable("content_overrides", {
  key: text("key").primaryKey(),
  text: text("text"),
  style: jsonb("style"),
  image: text("image"),
  hidden: boolean("hidden").notNull().default(false),
  updatedById: text("updated_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});


/**
 * Document-shaped collections.
 *
 * Some things the admin saves are not rows with columns — a built page's block
 * tree, a menu, a trip override, a chat interest. They were living in
 * `content/*.json`, which is fine on a laptop and **ephemeral on a serverless
 * deploy**: every trip price the admin published was lost on the next deploy.
 * The same data-loss class that moved the CRM onto Postgres in the first place.
 *
 * One table rather than five, because the shape is identical and the
 * alternative is a migration every time a new editable thing appears.
 *
 * The payload is jsonb, so it is queryable if it ever needs to be, and the
 * (collection, key) pair is unique so an upsert has something to target.
 */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    collection: text("collection").notNull(),
    // The natural key within the collection — a slug, a page path, a
    // conversation id. Null for rows that have no natural key of their own.
    key: text("key"),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("documents_collection_key_unique").on(t.collection, t.key),
    index("documents_collection_idx").on(t.collection),
  ]
);

/** Trip and destination overrides from the admin catalogue editor. */
export const catalogueOverrides = pgTable(
  "catalogue_overrides",
  {
    id: id(),
    kind: text("kind").notNull(), // "trip" | "destination"
    slug: text("slug").notNull(),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [uniqueIndex("catalogue_overrides_kind_slug_unique").on(t.kind, t.slug)]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  ownedLeads: many(leads),
  notifications: many(notifications),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  owner: one(users, { fields: [leads.ownerId], references: [users.id] }),
  quotations: many(quotations),
  bookings: many(bookings),
}));

export const quotationsRelations = relations(quotations, ({ one }) => ({
  lead: one(leads, { fields: [quotations.leadId], references: [leads.id] }),
  owner: one(users, { fields: [quotations.ownerId], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  lead: one(leads, { fields: [bookings.leadId], references: [leads.id] }),
  quotation: one(quotations, { fields: [bookings.quotationId], references: [quotations.id] }),
  departure: one(departures, { fields: [bookings.departureId], references: [departures.id] }),
  salesOwner: one(users, { fields: [bookings.salesOwnerId], references: [users.id] }),
  opsOwner: one(users, { fields: [bookings.opsOwnerId], references: [users.id] }),
  payments: many(payments),
  services: many(bookingServices),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  booking: one(bookings, { fields: [invoices.bookingId], references: [bookings.id] }),
}));

export const bookingServicesRelations = relations(bookingServices, ({ one }) => ({
  booking: one(bookings, { fields: [bookingServices.bookingId], references: [bookings.id] }),
}));
