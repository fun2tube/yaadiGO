CREATE TABLE "pageviews" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"path" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"max_scroll" integer,
	CONSTRAINT "pageviews_scroll_range" CHECK ("pageviews"."max_scroll" is null or "pageviews"."max_scroll" between 0 and 100),
	CONSTRAINT "pageviews_duration_not_negative" CHECK ("pageviews"."duration_ms" is null or "pageviews"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "site_events" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text,
	"name" text NOT NULL,
	"path" text,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"new_visitor" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"landing_path" text NOT NULL,
	"referrer_host" text,
	"channel" text NOT NULL,
	"source" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"device" text NOT NULL,
	"browser" text,
	"os" text,
	"timezone" text,
	"language" text,
	"pageviews" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "visits_pageviews_not_negative" CHECK ("visits"."pageviews" >= 0)
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "visit_id" text;--> statement-breakpoint
ALTER TABLE "pageviews" ADD CONSTRAINT "pageviews_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pageviews_visit_idx" ON "pageviews" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "pageviews_path_idx" ON "pageviews" USING btree ("path","at");--> statement-breakpoint
CREATE INDEX "pageviews_at_idx" ON "pageviews" USING btree ("at");--> statement-breakpoint
CREATE INDEX "site_events_name_idx" ON "site_events" USING btree ("name","at");--> statement-breakpoint
CREATE INDEX "site_events_visit_idx" ON "site_events" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visits_started_idx" ON "visits" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "visits_channel_idx" ON "visits" USING btree ("channel","started_at");--> statement-breakpoint
CREATE INDEX "visits_visitor_idx" ON "visits" USING btree ("visitor_id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE set null ON UPDATE no action;