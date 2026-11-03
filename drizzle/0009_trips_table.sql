CREATE TABLE "trip_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"trip_slug" text NOT NULL,
	"kind" text NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"content" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"live" jsonb,
	"draft" jsonb,
	"version" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_ref" text,
	"redirect_to" text,
	"published_at" timestamp with time zone,
	"published_by_name" text,
	"archived_at" timestamp with time zone,
	"created_by_name" text,
	"updated_by_id" text,
	"updated_by_name" text,
	"title" text GENERATED ALWAYS AS ((live ->> 'title')) STORED,
	"destination" text GENERATED ALWAYS AS ((live ->> 'destination')) STORED,
	"region" text GENERATED ALWAYS AS ((live ->> 'region')) STORED,
	"theme" text GENERATED ALWAYS AS ((live ->> 'theme')) STORED,
	"nights" integer GENERATED ALWAYS AS ((nullif(substring(live ->> 'duration' from '(\d+)\s*N'), '')::integer)) STORED,
	"from_price_paise" bigint GENERATED ALWAYS AS ((nullif((live ->> 'fromPrice'), '')::bigint * 100)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_kind" CHECK ("trips"."kind" in ('group', 'customized')),
	CONSTRAINT "trips_status" CHECK ("trips"."status" in ('draft', 'internal', 'published', 'archived')),
	CONSTRAINT "trips_version_not_negative" CHECK ("trips"."version" >= 0),
	CONSTRAINT "trips_live_when_visible" CHECK ("trips"."status" not in ('internal', 'published') or "trips"."live" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "trip_versions_key_unique" ON "trip_versions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "trip_versions_trip_idx" ON "trip_versions" USING btree ("trip_slug","version");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_slug_unique" ON "trips" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "trips" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "trips_destination_idx" ON "trips" USING btree ("destination");--> statement-breakpoint
-- MOVE: trips and versions saved by the admin until now lived in `documents`
-- (src/db/trips-table.test.ts re-runs everything below this line). The 34
-- trips still in code are moved by lib/cms/trip-import.js after deploy,
-- because their content is built by the app's own code.
INSERT INTO "trips" ("id", "slug", "kind", "status", "live", "draft", "version", "source", "source_ref", "redirect_to",
  "published_at", "published_by_name", "archived_at", "created_by_name", "updated_by_id", "updated_by_name", "created_at", "updated_at")
SELECT d.id,
  coalesce(d.data ->> 'slug', d.key),
  coalesce(d.data ->> 'kind', 'group'),
  coalesce(d.data ->> 'status', 'draft'),
  nullif(d.data -> 'live', 'null'::jsonb),
  nullif(d.data -> 'draft', 'null'::jsonb),
  coalesce((d.data ->> 'version')::integer, 0),
  coalesce(d.data ->> 'source', 'manual'),
  d.data ->> 'sourceRef',
  d.data ->> 'redirectTo',
  nullif(d.data ->> 'publishedAt', '')::timestamptz,
  d.data ->> 'publishedByName',
  nullif(d.data ->> 'archivedAt', '')::timestamptz,
  d.data ->> 'createdByName',
  d.data ->> 'updatedById',
  d.data ->> 'updatedByName',
  d.created_at,
  d.updated_at
FROM "documents" d
WHERE d.collection = 'trips'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "trip_versions" ("id", "key", "trip_slug", "kind", "version", "status", "content", "published_at", "published_by_name", "created_at", "updated_at")
SELECT d.id,
  coalesce(d.data ->> 'key', d.key),
  d.data ->> 'tripSlug',
  coalesce(d.data ->> 'kind', 'group'),
  coalesce((d.data ->> 'version')::integer, 0),
  coalesce(d.data ->> 'status', 'published'),
  d.data -> 'content',
  nullif(d.data ->> 'publishedAt', '')::timestamptz,
  d.data ->> 'publishedByName',
  d.created_at,
  d.updated_at
FROM "documents" d
WHERE d.collection = 'tripVersions'
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
DELETE FROM "documents" WHERE "collection" IN ('trips', 'tripVersions');
