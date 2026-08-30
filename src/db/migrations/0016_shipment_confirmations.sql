-- The client's half of the transport timeline.
--
-- Hand-written for the same reason 0002-0015 were: 0002 left no snapshot, so
-- `drizzle-kit generate` diffs against 0001 and re-emits the whole transport
-- realignment -- including a DROP of columns a live database still needs -- on
-- a database that already has it.
--
-- See docs/specs/transport_status_confirmation_spec.md.
--
-- The transporter moves `shipments.status`; the client attests that the
-- milestone really happened. Two different facts about one moment, which is
-- why this is a table and not a column or a `shipment_events` row. A row here
-- grants nothing: no status moves, no payment is captured, no listing closes.

DO $$ BEGIN
  CREATE TYPE "public"."shipment_confirmation_channel" AS ENUM('expedion_app', 'link');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- *Who* answered, as distinct from `channel`, which is *how*. An operator may
-- confirm on a client's behalf, and a timeline that cannot tell the two apart
-- would report an answer the client never gave.
DO $$ BEGIN
  CREATE TYPE "public"."shipment_confirmation_actor" AS ENUM('client', 'operator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipment_confirmations" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"milestone" "shipment_status" NOT NULL,
	"channel" "shipment_confirmation_channel" NOT NULL,
	"confirmed_by_role" "shipment_confirmation_actor" DEFAULT 'client' NOT NULL,
	-- Both nullable, and both needed: most Expedion clients have no `user` row
	-- at all -- they are quote owners keyed by `expedion_quotes.firebase_uid` --
	-- so a foreign key alone could not record who answered.
	"confirmed_by_user_id" text,
	"confirmed_by_ref" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_confirmations"
    ADD CONSTRAINT "shipment_confirmations_shipment_id_shipments_id_fk"
    FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shipment_confirmations"
    ADD CONSTRAINT "shipment_confirmations_confirmed_by_user_id_user_id_fk"
    FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- The idempotency key. A double-tapped link, a retried SMS and an app tap
-- after an email tap all land here; the service returns the existing row
-- rather than erroring.
CREATE UNIQUE INDEX IF NOT EXISTS "shipment_confirmation_unique"
  ON "shipment_confirmations" USING btree ("shipment_id","milestone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_confirmation_shipment_idx"
  ON "shipment_confirmations" USING btree ("shipment_id");
