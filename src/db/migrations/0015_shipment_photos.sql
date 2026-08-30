-- Pickup and delivery photos, each carrying the location it was taken at.
--
-- Hand-written for the same reason 0002-0014 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- See docs/specs/shipment_photos_spec.md.
--
-- `shipments.proof_of_delivery_url` is dropped rather than migrated into the
-- new table. It held one *public* URL and no location; the new table requires a
-- private object key and a fix. Converting would mean inventing exactly the
-- facts the table exists to guarantee, so instead each non-null value is
-- appended to `shipment_events` -- append-only history that is already
-- rendered on both parties' timelines. Nothing is lost and nothing is
-- fabricated.

DO $$ BEGIN
  CREATE TYPE "public"."shipment_photo_stage" AS ENUM('pickup', 'delivery');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"stage" "shipment_photo_stage" NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"captured_lat" double precision NOT NULL,
	"captured_lng" double precision NOT NULL,
	"captured_accuracy_m" double precision,
	"captured_address" text,
	"captured_at" timestamp NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by_user_id" text,
	"deleted_at" timestamp,
	"deleted_by_user_id" text,
	"deletion_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_photos"
    ADD CONSTRAINT "shipment_photos_shipment_id_shipments_id_fk"
    FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_photos"
    ADD CONSTRAINT "shipment_photos_uploaded_by_user_id_user_id_fk"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_photos"
    ADD CONSTRAINT "shipment_photos_deleted_by_user_id_user_id_fk"
    FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_photo_shipment_idx" ON "shipment_photos" USING btree ("shipment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_photo_stage_idx" ON "shipment_photos" USING btree ("shipment_id","stage");
--> statement-breakpoint
-- Preserve whatever proof of delivery already exists, as timeline history.
-- `md5(random() || clock_timestamp())` rather than `gen_random_uuid()`: the id
-- column is `text`, and this needs no extension on any server version.
INSERT INTO "shipment_events" ("id", "shipment_id", "status", "previous_status", "actor_id", "actor_role", "note", "metadata", "created_at")
SELECT
	md5(random()::text || clock_timestamp()::text),
	s."id",
	'DELIVERED',
	NULL,
	NULL,
	'system',
	'Proof of delivery recorded before shipment photos existed',
	json_build_object('legacyProofOfDeliveryUrl', s."proof_of_delivery_url")::text,
	COALESCE(s."delivered_at", s."updated_at")
FROM "shipments" s
WHERE s."proof_of_delivery_url" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "shipments" DROP COLUMN IF EXISTS "proof_of_delivery_url";
