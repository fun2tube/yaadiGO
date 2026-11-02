ALTER TYPE "public"."role" ADD VALUE 'accounts';--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"financial_year" text NOT NULL,
	"sequence" integer NOT NULL,
	"invoice_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"booking_id" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by_id" text,
	"issued_by_name" text,
	"reason" text NOT NULL,
	"tax_percent" integer DEFAULT 5 NOT NULL,
	"taxable_paise" bigint DEFAULT 0 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"tax_split" jsonb,
	"currency" text DEFAULT 'INR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_total_positive" CHECK ("credit_notes"."total_paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "place_of_supply_code" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sac" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_split" jsonb;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_number_unique" ON "credit_notes" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_fy_sequence_unique" ON "credit_notes" USING btree ("financial_year","sequence");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_idx" ON "credit_notes" USING btree ("invoice_id");