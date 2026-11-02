ALTER TABLE "leads" ADD COLUMN "departure_date" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "departure_flexible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "return_date" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "adults" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "children" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "infants" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "budget_amount_paise" bigint;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "budget_per_person" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "brief" jsonb;--> statement-breakpoint
CREATE INDEX "leads_departure_idx" ON "leads" USING btree ("departure_date");