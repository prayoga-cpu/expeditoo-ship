-- Realign the transport schema with the database.
--
-- The database was still carrying the v1 goods-auction shape: `listings` had
-- seller_id/start_price/ends_at, `shipments` had user_id/package_weight, and
-- `payments` had amount/application_fee_amount. Every query the app makes
-- against those three tables failed with "column does not exist", which is why
-- deliveries, the award queue and the admin listings/shipments/payments screens
-- all returned 500.
--
-- The three tables are rebuilt rather than altered: their v1 rows are
-- goods-auction records carrying no pickup window, budget or origin, so there
-- is nothing in them that maps onto a transport job.
--
-- Untouched: user, user_roles, offers, carriers, vehicles, carrier_documents
-- and expedion_quotes. The 4,591 imported quotes are safe in particular --
-- listing_id is null on every one of them, so none references a listing.

-- 1. Drop the v1 tables the schema no longer defines.
DROP TABLE IF EXISTS "bids" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "orders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "earnings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "listing_images" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shipment_proposals" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "transporter_profiles" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "driver_applications" CASCADE;--> statement-breakpoint
-- 2. Clear references that would dangle once the tables are rebuilt. Two
-- conversations point at v1 listings; their messages are kept, the stale link
-- is not.
UPDATE "conversations" SET "listing_id" = NULL WHERE "listing_id" IS NOT NULL;--> statement-breakpoint
-- The seven events belong to the two v1 shipments being dropped.
DELETE FROM "shipment_events";--> statement-breakpoint
-- 3. Rebuild the drifted tables. CASCADE also drops the inbound foreign keys,
-- which step 5 restores.
DROP TABLE IF EXISTS "payments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shipments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "listings" CASCADE;--> statement-breakpoint
-- 4. Canonical definitions, taken verbatim from 0000_old_slayback.
CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"shipper_id" text NOT NULL,
	"category_id" text NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"weight_kg" double precision NOT NULL,
	"length_cm" double precision,
	"width_cm" double precision,
	"height_cm" double precision,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_fragile" boolean DEFAULT false NOT NULL,
	"needs_help" boolean DEFAULT false NOT NULL,
	"pickup_lat" double precision NOT NULL,
	"pickup_lng" double precision NOT NULL,
	"pickup_address" text NOT NULL,
	"pickup_city" text NOT NULL,
	"pickup_postal_code" text NOT NULL,
	"pickup_location_type" "location_type" NOT NULL,
	"pickup_floor" integer,
	"pickup_has_lift" boolean,
	"dropoff_lat" double precision NOT NULL,
	"dropoff_lng" double precision NOT NULL,
	"dropoff_address" text NOT NULL,
	"dropoff_city" text NOT NULL,
	"dropoff_postal_code" text NOT NULL,
	"dropoff_location_type" "location_type" NOT NULL,
	"dropoff_floor" integer,
	"dropoff_has_lift" boolean,
	"pickup_from" timestamp NOT NULL,
	"pickup_until" timestamp NOT NULL,
	"dropoff_from" timestamp NOT NULL,
	"dropoff_until" timestamp NOT NULL,
	"is_flexible" boolean DEFAULT false NOT NULL,
	"budget_cents" integer NOT NULL,
	"accepted_offer_id" text,
	"origin" "listing_origin" DEFAULT 'direct' NOT NULL,
	"external_ref" text,
	"offers_count" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"shipper_id" text NOT NULL,
	"carrier_id" text NOT NULL,
	"driver_id" text,
	"status" "shipment_status" DEFAULT 'PENDING' NOT NULL,
	"pickup_lat" double precision NOT NULL,
	"pickup_lng" double precision NOT NULL,
	"pickup_address" text NOT NULL,
	"dropoff_lat" double precision NOT NULL,
	"dropoff_lng" double precision NOT NULL,
	"dropoff_address" text NOT NULL,
	"price_cents" integer NOT NULL,
	"scheduled_pickup" timestamp,
	"scheduled_delivery" timestamp,
	"proof_of_delivery_url" text,
	"picked_up_at" timestamp,
	"delivered_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"amount_cents" integer NOT NULL,
	"commission_cents" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"transfer_group" text,
	"failure_reason" text,
	"listing_id" text,
	"shipment_id" text,
	"authorised_at" timestamp,
	"captured_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "payments_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);--> statement-breakpoint
-- 5. Foreign keys owned by the rebuilt tables.
ALTER TABLE "listings" ADD CONSTRAINT "listings_shipper_id_user_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipper_id_user_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_user_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- 6. Foreign keys from other tables back into them, dropped by the CASCADE.
ALTER TABLE "photos" ADD CONSTRAINT "photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 7. Indexes.
CREATE INDEX "listing_shipper_idx" ON "listings" USING btree ("shipper_id");--> statement-breakpoint
CREATE INDEX "listing_category_idx" ON "listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "listing_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listing_expires_idx" ON "listings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "listing_origin_idx" ON "listings" USING btree ("origin");--> statement-breakpoint
CREATE INDEX "listing_pickup_geo_idx" ON "listings" USING btree ("pickup_lat","pickup_lng");--> statement-breakpoint
CREATE INDEX "listing_search_idx" ON "listings" USING gin (to_tsvector('french', "title" || ' ' || "description"));--> statement-breakpoint
CREATE INDEX "shipment_listing_idx" ON "shipments" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "shipment_shipper_idx" ON "shipments" USING btree ("shipper_id");--> statement-breakpoint
CREATE INDEX "shipment_carrier_idx" ON "shipments" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "shipment_driver_idx" ON "shipments" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "shipment_status_idx" ON "shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_stripe_pi_idx" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_shipment_idx" ON "payments" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payments" USING btree ("status");
