CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"collection" text NOT NULL,
	"key" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "documents_collection_key_unique" ON "documents" USING btree ("collection","key");--> statement-breakpoint
CREATE INDEX "documents_collection_idx" ON "documents" USING btree ("collection");