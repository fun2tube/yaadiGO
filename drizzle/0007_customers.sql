CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"phone_key" text,
	"email" text,
	"email_key" text,
	"company" text,
	"city" text,
	"first_source" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_reachable" CHECK ("customers"."phone_key" is not null or "customers"."email_key" is not null),
	CONSTRAINT "customers_consent_dated" CHECK (not "customers"."marketing_consent" or "customers"."consent_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "customer_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_key_unique" ON "customers" USING btree ("phone_key");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_key_unique" ON "customers" USING btree ("email_key");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_customer_idx" ON "leads" USING btree ("customer_id");--> statement-breakpoint
-- BACKFILL: one customer per person already in leads (src/db/customers.test.ts
-- re-runs everything below this line against real rows). Keys match
-- lib/crm/contact-keys.js: last ten digits; email lower-cased and trimmed.
-- 1. A customer per distinct phone, named and dated from their first lead.
INSERT INTO "customers" ("id", "name", "phone", "phone_key", "company", "first_source", "first_seen_at")
SELECT gen_random_uuid()::text, f.name, f.phone, f.pk, f.company, f.source, f.received_at
FROM (
  SELECT DISTINCT ON (pk) pk, name, phone, company, source, received_at
  FROM (
    SELECT *, right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) AS pk
    FROM "leads"
    WHERE length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
  ) keyed
  ORDER BY pk, received_at
) f
WHERE NOT EXISTS (SELECT 1 FROM "customers" c WHERE c.phone_key = f.pk);--> statement-breakpoint
-- 2. Their email, where that email belongs to this one phone only.
UPDATE "customers" c SET "email" = k.email, "email_key" = k.ek
FROM (
  SELECT DISTINCT ON (pk) pk, email, ek FROM (
    SELECT received_at, email,
           right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) AS pk,
           nullif(lower(trim(coalesce(email, ''))), '') AS ek
    FROM "leads"
    WHERE length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
  ) keyed
  WHERE ek IS NOT NULL
  ORDER BY pk, received_at
) k
WHERE c.phone_key = k.pk AND c.email_key IS NULL
  AND NOT EXISTS (SELECT 1 FROM "customers" o WHERE o.email_key = k.ek)
  AND k.ek IN (
    SELECT nullif(lower(trim(coalesce(email, ''))), '') FROM "leads"
    WHERE length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10 AND nullif(trim(coalesce(email, '')), '') IS NOT NULL
    GROUP BY 1 HAVING count(DISTINCT right(regexp_replace(phone, '\D', '', 'g'), 10)) = 1
  );--> statement-breakpoint
-- 3. A customer per email for leads with no usable phone.
INSERT INTO "customers" ("id", "name", "email", "email_key", "company", "first_source", "first_seen_at")
SELECT gen_random_uuid()::text, f.name, f.email, f.ek, f.company, f.source, f.received_at
FROM (
  SELECT DISTINCT ON (ek) ek, name, email, company, source, received_at
  FROM (
    SELECT *, nullif(lower(trim(coalesce(email, ''))), '') AS ek FROM "leads"
    WHERE length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) < 10
  ) keyed
  WHERE ek IS NOT NULL
  ORDER BY ek, received_at
) f
WHERE NOT EXISTS (SELECT 1 FROM "customers" c WHERE c.email_key = f.ek);--> statement-breakpoint
-- 4. Link every lead: by phone first, then by email.
UPDATE "leads" l SET "customer_id" = c.id FROM "customers" c
WHERE l.customer_id IS NULL
  AND length(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g')) >= 10
  AND c.phone_key = right(regexp_replace(l.phone, '\D', '', 'g'), 10);--> statement-breakpoint
UPDATE "leads" l SET "customer_id" = c.id FROM "customers" c
WHERE l.customer_id IS NULL
  AND c.email_key = nullif(lower(trim(coalesce(l.email, ''))), '');
