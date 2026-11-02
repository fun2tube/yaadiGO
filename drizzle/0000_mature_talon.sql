CREATE TYPE "public"."booking_stage" AS ENUM('requested', 'confirmed', 'part-paid', 'paid', 'in-progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacted', 'qualified', 'quoted', 'negotiating', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('advance', 'instalment', 'balance', 'refund');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'approved', 'rejected', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'manager', 'sales', 'ops');--> statement-breakpoint
CREATE TYPE "public"."service_kind" AS ENUM('flight', 'hotel', 'cab', 'train', 'activity', 'guide', 'permit', 'other');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('todo', 'requested', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'pending', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "booking_services" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"kind" "service_kind" NOT NULL,
	"status" "service_status" DEFAULT 'todo' NOT NULL,
	"title" text NOT NULL,
	"supplier" text,
	"reference" text,
	"starts_at" text,
	"ends_at" text,
	"cost_paise" bigint DEFAULT 0 NOT NULL,
	"assigned_to_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"source" text NOT NULL,
	"lead_id" text,
	"quotation_id" text,
	"departure_id" text,
	"trip_slug" text,
	"status" "booking_stage" DEFAULT 'requested' NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"trip_title" text NOT NULL,
	"travellers" integer DEFAULT 1 NOT NULL,
	"departure_label" text,
	"departure_start" text,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"per_person_paise" bigint DEFAULT 0 NOT NULL,
	"advance_paise" bigint DEFAULT 0 NOT NULL,
	"balance_paise" bigint DEFAULT 0 NOT NULL,
	"collected_paise" bigint DEFAULT 0 NOT NULL,
	"sales_owner_id" text,
	"ops_owner_id" text,
	"handed_to_ops_at" timestamp with time zone,
	"itinerary" jsonb,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seats_held" integer DEFAULT 0 NOT NULL,
	"seats_left_at_request" integer,
	"sharing" text,
	"pickup" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_collected_non_negative" CHECK ("bookings"."collected_paise" >= 0),
	CONSTRAINT "bookings_has_origin" CHECK ("bookings"."lead_id" is not null or "bookings"."departure_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "catalogue_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_overrides" (
	"key" text PRIMARY KEY NOT NULL,
	"text" text,
	"style" jsonb,
	"image" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departures" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_slug" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"price_paise" bigint NOT NULL,
	"seats_total" integer NOT NULL,
	"seats_left" integer NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departures_seats_not_negative" CHECK ("departures"."seats_left" >= 0),
	CONSTRAINT "departures_seats_within_total" CHECK ("departures"."seats_left" <= "departures"."seats_total"),
	CONSTRAINT "departures_ends_after_start" CHECK ("departures"."end_date" > "departures"."start_date")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"lead_id" text,
	"quotation_id" text,
	"booking_id" text,
	"owner_id" text,
	"amount_paise" bigint,
	"currency" text DEFAULT 'INR' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"financial_year" text NOT NULL,
	"sequence" integer NOT NULL,
	"booking_id" text NOT NULL,
	"lead_id" text,
	"quotation_id" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by_id" text,
	"issued_by_name" text,
	"seller" jsonb NOT NULL,
	"customer" jsonb NOT NULL,
	"place_of_supply" text,
	"title" text NOT NULL,
	"travellers" integer,
	"travel_dates" text,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_percent" integer DEFAULT 5 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"company" text,
	"role" text,
	"destination" text,
	"dates" text,
	"group_size" integer,
	"budget" text,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message" text,
	"monthly_trips" integer,
	"itinerary" jsonb,
	"source" text DEFAULT 'unknown' NOT NULL,
	"status" "lead_stage" DEFAULT 'new' NOT NULL,
	"lost_reason" text,
	"owner_id" text,
	"follow_up_at" timestamp with time zone,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"value_paise" bigint,
	"booking_id" text,
	"converted_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_lost_needs_reason" CHECK ("leads"."status" <> 'lost' or "leads"."lost_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read" boolean DEFAULT false NOT NULL,
	"lead_id" text,
	"booking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"event" text,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"lead_id" text,
	"booking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"lead_id" text,
	"kind" "payment_kind" DEFAULT 'instalment' NOT NULL,
	"amount_paise" bigint NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"note" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_id" text,
	"recorded_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_refunds_negative" CHECK (("payments"."kind" = 'refund' and "payments"."amount_paise" < 0) or ("payments"."kind" <> 'refund' and "payments"."amount_paise" > 0))
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"version" integer NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"destination" text,
	"duration_days" integer,
	"start_date" text,
	"summary" text,
	"itinerary" jsonb,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"terms" text,
	"travellers" integer DEFAULT 1 NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"cost_paise" bigint DEFAULT 0 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_percent" integer DEFAULT 5 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"per_person_paise" bigint DEFAULT 0 NOT NULL,
	"gross_margin_paise" bigint,
	"margin_percent" integer,
	"owner_id" text,
	"created_by_id" text,
	"created_by_name" text,
	"token" text NOT NULL,
	"sent_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"valid_until" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_total_non_negative" CHECK ("quotations"."total_paise" >= 0),
	CONSTRAINT "quotations_travellers_positive" CHECK ("quotations"."travellers" >= 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "role" DEFAULT 'sales' NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"password_hash" text,
	"google_id" text,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"reset_token_hash" text,
	"reset_expires_at" timestamp with time zone,
	"monthly_target_paise" bigint,
	"invited_by_id" text,
	"invited_by_name" text,
	"approved_by_id" text,
	"approved_by_name" text,
	"accepted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_sales_owner_id_users_id_fk" FOREIGN KEY ("sales_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ops_owner_id_users_id_fk" FOREIGN KEY ("ops_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_services_booking_idx" ON "booking_services" USING btree ("booking_id","starts_at");--> statement-breakpoint
CREATE INDEX "booking_services_status_idx" ON "booking_services" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_unique" ON "bookings" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_lead_idx" ON "bookings" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "bookings_sales_owner_idx" ON "bookings" USING btree ("sales_owner_id");--> statement-breakpoint
CREATE INDEX "bookings_ops_owner_idx" ON "bookings" USING btree ("ops_owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_overrides_kind_slug_unique" ON "catalogue_overrides" USING btree ("kind","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "departures_trip_start_unique" ON "departures" USING btree ("trip_slug","start_date");--> statement-breakpoint
CREATE INDEX "departures_trip_idx" ON "departures" USING btree ("trip_slug");--> statement-breakpoint
CREATE INDEX "events_at_idx" ON "events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "events_type_at_idx" ON "events" USING btree ("type","at");--> statement-breakpoint
CREATE INDEX "events_lead_idx" ON "events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "events_booking_idx" ON "events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "events_owner_at_idx" ON "events" USING btree ("owner_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_fy_sequence_unique" ON "invoices" USING btree ("financial_year","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_booking_unique" ON "invoices" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "invoices_issued_idx" ON "invoices" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_owner_idx" ON "leads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "leads_received_idx" ON "leads" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "leads_followup_idx" ON "leads" USING btree ("follow_up_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "outbox_created_idx" ON "outbox" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id","received_at");--> statement-breakpoint
CREATE INDEX "payments_lead_idx" ON "payments" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_token_unique" ON "quotations" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_lead_version_unique" ON "quotations" USING btree ("lead_id","version");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_owner_idx" ON "quotations" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_unique" ON "users" USING btree ("google_id") WHERE "users"."google_id" is not null;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");