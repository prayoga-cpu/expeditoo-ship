-- A price offer sent inside a message thread.
--
-- Hand-written for the same reason 0002-0017 were: 0002 left no snapshot in
-- meta/, so `drizzle-kit generate` diffs against 0001 and re-emits the whole
-- transport realignment on a database that already has it.
--
-- The row carries exactly ONE pickup slot, never the twelve SubmitOfferForm
-- allows on the job page. That is what makes accepting inside the chat bubble
-- safe: offersService.acceptOffer takes no slotId for a one-slot offer, so
-- there is no wrong slot to book. See docs/specs/thread_offer_spec.md §1.2.
--
-- `offer_id` bridges to the real reverse auction on the job lane and stays NULL
-- on the standalone lane. SET NULL on both foreign keys that can disappear:
-- deleting a listing cascades its offers, and the conversation must keep the
-- card rather than silently lose a turn.

DO $$ BEGIN
  CREATE TYPE "public"."thread_offer_status" AS ENUM('pending', 'accepted', 'declined', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "thread_offers" (
  "id" text PRIMARY KEY NOT NULL,
  "conversation_id" text NOT NULL,
  "sender_id" text NOT NULL,
  "price_cents" integer NOT NULL,
  "pickup_day" text NOT NULL,
  "pickup_slot" "time_slot" NOT NULL,
  "delivery_lead_days" integer DEFAULT 0 NOT NULL,
  "tz_offset" integer DEFAULT 0 NOT NULL,
  "pickup_at" timestamp NOT NULL,
  "delivery_at" timestamp NOT NULL,
  "note" text,
  "vehicle_id" text,
  "offer_id" text,
  "status" "thread_offer_status" DEFAULT 'pending' NOT NULL,
  "responded_at" timestamp,
  "responded_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "thread_offers" ADD CONSTRAINT "thread_offers_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "thread_offers" ADD CONSTRAINT "thread_offers_sender_id_user_id_fk"
    FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "thread_offers" ADD CONSTRAINT "thread_offers_vehicle_id_vehicles_id_fk"
    FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "thread_offers" ADD CONSTRAINT "thread_offers_offer_id_offers_id_fk"
    FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "thread_offers" ADD CONSTRAINT "thread_offers_responded_by_user_id_fk"
    FOREIGN KEY ("responded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "thread_offer_conversation_idx" ON "thread_offers" USING btree ("conversation_id");--> statement-breakpoint

-- One live offer per sender per thread. Mirrors offer_one_live_per_carrier: a
-- chat invites haggling, and without this a sender can bury the thread in
-- competing prices with no way to tell which one still stands.
CREATE UNIQUE INDEX IF NOT EXISTS "thread_offer_one_live_per_sender" ON "thread_offers" USING btree ("conversation_id","sender_id") WHERE "thread_offers"."status" = 'pending';--> statement-breakpoint

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "thread_offer_id" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_offer_id_thread_offers_id_fk"
    FOREIGN KEY ("thread_offer_id") REFERENCES "public"."thread_offers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
