CREATE TABLE "hotel_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"hotel_id" text NOT NULL,
	"room_type" text NOT NULL,
	"meal_plan" text NOT NULL,
	"season" text,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"cost_paise" bigint NOT NULL,
	"sell_paise" bigint NOT NULL,
	"extra_bed_cost_paise" bigint,
	"extra_bed_sell_paise" bigint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotel_rates_meal_plan" CHECK ("hotel_rates"."meal_plan" in ('EP', 'CP', 'MAP', 'AP')),
	CONSTRAINT "hotel_rates_dates" CHECK ("hotel_rates"."valid_to" >= "hotel_rates"."valid_from"),
	CONSTRAINT "hotel_rates_cost_not_negative" CHECK ("hotel_rates"."cost_paise" >= 0),
	CONSTRAINT "hotel_rates_sell_covers_cost" CHECK ("hotel_rates"."sell_paise" >= "hotel_rates"."cost_paise"),
	CONSTRAINT "hotel_rates_extra_bed" CHECK ("hotel_rates"."extra_bed_cost_paise" is null or "hotel_rates"."extra_bed_sell_paise" is null or "hotel_rates"."extra_bed_sell_paise" >= "hotel_rates"."extra_bed_cost_paise")
);
--> statement-breakpoint
CREATE TABLE "hotels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"destination" text NOT NULL,
	"city" text,
	"category" text DEFAULT 'hotel' NOT NULL,
	"stars" integer,
	"address" text,
	"contact_person" text,
	"phone" text,
	"email" text,
	"website" text,
	"notes" text,
	"image_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotels_stars_range" CHECK ("hotels"."stars" is null or "hotels"."stars" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "hotel_rates" ADD CONSTRAINT "hotel_rates_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hotel_rates_hotel_idx" ON "hotel_rates" USING btree ("hotel_id","valid_from");--> statement-breakpoint
CREATE INDEX "hotels_destination_idx" ON "hotels" USING btree ("destination");--> statement-breakpoint
CREATE UNIQUE INDEX "hotels_name_place_unique" ON "hotels" USING btree (lower("name"),lower(coalesce("city", "destination")));