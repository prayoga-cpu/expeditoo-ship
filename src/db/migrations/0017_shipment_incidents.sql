-- "Something has gone wrong", from either side of a running job.
--
-- Hand-written for the same reason 0002-0015 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- See docs/specs/incident_reporting_spec.md.
--
-- Nothing here touches `shipments` or `payments`. An incident is a report, not
-- a lever; the coupling it deliberately does not have is the point of the
-- feature, and a migration that added a status column to `shipments` would be
-- the first step in losing that.

DO $$ BEGIN
  CREATE TYPE "public"."shipment_incident_category" AS ENUM('damage', 'delay', 'access', 'vehicle', 'cargo_mismatch', 'safety', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."shipment_incident_severity" AS ENUM('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."shipment_incident_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"category" "shipment_incident_category" NOT NULL,
	"severity" "shipment_incident_severity" DEFAULT 'medium' NOT NULL,
	"status" "shipment_incident_status" DEFAULT 'OPEN' NOT NULL,
	"description" text NOT NULL,
	"photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reported_by_user_id" text,
	"reported_by_role" "actor_role" NOT NULL,
	"conversation_id" text,
	"acknowledged_at" timestamp,
	"acknowledged_by_user_id" text,
	"resolved_at" timestamp,
	"resolved_by_user_id" text,
	"resolution_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_incidents"
    ADD CONSTRAINT "shipment_incidents_shipment_id_shipments_id_fk"
    FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_incidents"
    ADD CONSTRAINT "shipment_incidents_reported_by_user_id_user_id_fk"
    FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_incidents"
    ADD CONSTRAINT "shipment_incidents_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_incidents"
    ADD CONSTRAINT "shipment_incidents_acknowledged_by_user_id_user_id_fk"
    FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_incidents"
    ADD CONSTRAINT "shipment_incidents_resolved_by_user_id_user_id_fk"
    FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_incident_shipment_idx" ON "shipment_incidents" USING btree ("shipment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_incident_status_idx" ON "shipment_incidents" USING btree ("status");
--> statement-breakpoint
-- The operator queue reads open incidents newest-first on every page load.
CREATE INDEX IF NOT EXISTS "shipment_incident_queue_idx" ON "shipment_incidents" USING btree ("status","created_at");
