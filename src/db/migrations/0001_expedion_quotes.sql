CREATE TYPE "public"."expedion_payment_status" AS ENUM('unpaid', 'processing', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."expedion_quote_kind" AS ENUM('standard', 'with_ad_valorem_insurance');--> statement-breakpoint
CREATE TYPE "public"."expedion_quote_status" AS ENUM('pending', 'awaiting_confirmation', 'quoted', 'accepted', 'paid', 'assigned', 'escalated', 'picked_up', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "expedion_quote_events" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"status" "expedion_quote_status" NOT NULL,
	"message" text,
	"actor" text DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expedion_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"airtable_record_id" text,
	"airtable_fields" jsonb,
	"firebase_uid" text NOT NULL,
	"user_id" text,
	"quote_number" text,
	"bordereau_number" text,
	"bordereau_paid" boolean DEFAULT false NOT NULL,
	"bordereau_doc_url" text,
	"photo_urls" jsonb,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"client_address" text,
	"client_postal_code" text,
	"client_city" text,
	"client_country" text,
	"auction_house_name" text,
	"pickup_address" text,
	"pickup_postal_code" text,
	"pickup_city" text,
	"pickup_phone" text,
	"pickup_lat" double precision,
	"pickup_lng" double precision,
	"sale_date" timestamp,
	"recipient_name" text,
	"delivery_address" text,
	"delivery_address_line2" text,
	"delivery_postal_code" text,
	"delivery_city" text,
	"delivery_country" text,
	"delivery_phone" text,
	"delivery_lat" double precision,
	"delivery_lng" double precision,
	"description" text,
	"length_cm" double precision,
	"width_cm" double precision,
	"height_cm" double precision,
	"weight_kg" double precision,
	"is_protected" boolean DEFAULT false NOT NULL,
	"declared_value_cents" integer,
	"value_bracket" text,
	"quote_standard_cents" integer,
	"quote_insured_cents" integer,
	"accepted_kind" "expedion_quote_kind",
	"accepted_price_cents" integer,
	"quote_available" boolean DEFAULT false NOT NULL,
	"status" "expedion_quote_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "expedion_payment_status" DEFAULT 'unpaid' NOT NULL,
	"assigned_carrier_id" text,
	"assigned_at" timestamp,
	"listing_id" text,
	"escalated_at" timestamp,
	"escalate_after" timestamp,
	"storage_free_until" timestamp,
	"storage_daily_fee_cents" integer,
	"extraction" jsonb,
	"extraction_model" text,
	"extraction_confidence" double precision,
	"extraction_confirmed_at" timestamp,
	"comment" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expedion_quotes_airtable_record_id_unique" UNIQUE("airtable_record_id")
);
--> statement-breakpoint
ALTER TABLE "expedion_quote_events" ADD CONSTRAINT "expedion_quote_events_quote_id_expedion_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."expedion_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD CONSTRAINT "expedion_quotes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD CONSTRAINT "expedion_quotes_assigned_carrier_id_carriers_id_fk" FOREIGN KEY ("assigned_carrier_id") REFERENCES "public"."carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedion_quotes" ADD CONSTRAINT "expedion_quotes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expedion_event_quote_idx" ON "expedion_quote_events" USING btree ("quote_id","created_at");--> statement-breakpoint
CREATE INDEX "expedion_quote_uid_idx" ON "expedion_quotes" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "expedion_quote_status_idx" ON "expedion_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expedion_quote_bordereau_idx" ON "expedion_quotes" USING btree ("bordereau_number");--> statement-breakpoint
CREATE INDEX "expedion_quote_listing_idx" ON "expedion_quotes" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "expedion_quote_carrier_idx" ON "expedion_quotes" USING btree ("assigned_carrier_id");--> statement-breakpoint
CREATE INDEX "expedion_quote_escalate_idx" ON "expedion_quotes" USING btree ("escalate_after");