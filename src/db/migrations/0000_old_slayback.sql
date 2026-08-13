CREATE TYPE "public"."carrier_document_kind" AS ENUM('cni_recto', 'cni_verso', 'driving_licence', 'kbis', 'insurance_certificate', 'transport_licence', 'rib');--> statement-breakpoint
CREATE TYPE "public"."carrier_document_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."carrier_status" AS ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('motorcycle', 'car', 'van', 'truck_3_5t', 'truck_7_5t', 'truck_19t', 'semi_trailer', 'flatbed', 'refrigerated');--> statement-breakpoint
CREATE TYPE "public"."stripe_account_status" AS ENUM('pending', 'active', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('shipper', 'carrier', 'driver', 'operator', 'support', 'finance', 'admin');--> statement-breakpoint
CREATE TYPE "public"."listing_origin" AS ENUM('direct', 'expedion');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'open', 'awarded', 'in_progress', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('house', 'apartment', 'warehouse', 'factory', 'construction_site', 'shop', 'office', 'storage_unit', 'farm', 'port', 'airport', 'rail_terminal', 'other');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('pending', 'accepted', 'rejected', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."actor_role" AS ENUM('system', 'shipper', 'carrier', 'driver', 'operator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."review_role" AS ENUM('shipper', 'carrier');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorising', 'authorised', 'captured', 'failed', 'refunded', 'released');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('scheduled', 'processing', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"street" text NOT NULL,
	"city" text NOT NULL,
	"zip" text NOT NULL,
	"country" text NOT NULL,
	"details" text,
	"lat" double precision,
	"lng" double precision,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"kind" "carrier_document_kind" NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"expires_at" timestamp,
	"status" "carrier_document_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carrier_document_kind_unique" UNIQUE("carrier_id","kind")
);
--> statement-breakpoint
CREATE TABLE "carrier_drivers" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	CONSTRAINT "carrier_driver_unique" UNIQUE("carrier_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"siret" text NOT NULL,
	"vat_number" text,
	"legal_form" text,
	"contact_phone" text NOT NULL,
	"address_line" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"status" "carrier_status" DEFAULT 'draft' NOT NULL,
	"iban_last4" text,
	"bic_last4" text,
	"stripe_account_id" text,
	"approved_at" timestamp,
	"approved_by" text,
	"rejection_reason" text,
	"suspension_reason" text,
	"average_rating" double precision DEFAULT 0 NOT NULL,
	"total_ratings" integer DEFAULT 0 NOT NULL,
	"completed_jobs" integer DEFAULT 0 NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carriers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "carriers_siret_unique" UNIQUE("siret")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"type" "vehicle_type" NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"plate_number" text NOT NULL,
	"max_weight_kg" double precision NOT NULL,
	"max_length_cm" double precision,
	"max_width_cm" double precision,
	"max_height_cm" double precision,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_plate_per_carrier" UNIQUE("carrier_id","plate_number")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"banned" boolean DEFAULT false NOT NULL,
	"rating" double precision DEFAULT 0 NOT NULL,
	"reputation_score" integer DEFAULT 0 NOT NULL,
	"stripe_account_id" text,
	"stripe_account_status" "stripe_account_status" DEFAULT 'pending',
	"stripe_customer_id" text,
	"preferences" jsonb DEFAULT '{"notifications":{"email":{"offerReceived":true,"offerAccepted":true,"offerRejected":true,"paymentConfirmation":true,"shipmentUpdates":true,"invoiceReady":true,"marketing":false,"security":true},"inApp":{"offerReceived":true,"offerAccepted":true,"offerRejected":true,"paymentConfirmation":true,"shipmentUpdates":true,"invoiceReady":true,"messages":true}}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" "user_role" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" text
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image" text,
	"parent_id" text,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"url" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"carrier_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"estimated_pickup" timestamp NOT NULL,
	"estimated_delivery" timestamp NOT NULL,
	"message" text,
	"status" "offer_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"status" "shipment_status" NOT NULL,
	"previous_status" "shipment_status",
	"actor_id" text,
	"actor_role" "actor_role" NOT NULL,
	"note" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"last_cleared_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'LISTING' NOT NULL,
	"listing_id" text,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"attachment_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"target_user_id" text NOT NULL,
	"author_id" text NOT NULL,
	"listing_id" text,
	"shipment_id" text,
	"role" "review_role" NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"carrier_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"payment_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"status" "payout_status" DEFAULT 'scheduled' NOT NULL,
	"stripe_transfer_id" text,
	"failure_reason" text,
	"scheduled_for" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link_url" text,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp,
	"due_at" timestamp,
	"paid_at" timestamp,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "search_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"query" text NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"category" text,
	"filters" text,
	"clicked_listing_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_documents" ADD CONSTRAINT "carrier_documents_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_drivers" ADD CONSTRAINT "carrier_drivers_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_drivers" ADD CONSTRAINT "carrier_drivers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_shipper_id_user_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_carrier_id_user_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipper_id_user_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_user_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driver_id_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_carrier_id_user_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_analytics" ADD CONSTRAINT "search_analytics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_userId_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "addresses_isDefault_idx" ON "addresses" USING btree ("user_id","is_default");--> statement-breakpoint
CREATE INDEX "carrier_document_carrier_idx" ON "carrier_documents" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carrier_document_expiry_idx" ON "carrier_documents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "carrier_driver_carrier_idx" ON "carrier_drivers" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carrier_driver_user_idx" ON "carrier_drivers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carrier_user_idx" ON "carriers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carrier_status_idx" ON "carriers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "carrier_rating_idx" ON "carriers" USING btree ("average_rating");--> statement-breakpoint
CREATE INDEX "vehicle_carrier_idx" ON "vehicles" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "vehicle_active_idx" ON "vehicles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_rating_idx" ON "user" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "user_reputation_idx" ON "user" USING btree ("reputation_score");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "listing_shipper_idx" ON "listings" USING btree ("shipper_id");--> statement-breakpoint
CREATE INDEX "listing_category_idx" ON "listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "listing_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listing_expires_idx" ON "listings" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "listing_origin_idx" ON "listings" USING btree ("origin");--> statement-breakpoint
CREATE INDEX "listing_pickup_geo_idx" ON "listings" USING btree ("pickup_lat","pickup_lng");--> statement-breakpoint
CREATE INDEX "listing_search_idx" ON "listings" USING gin (to_tsvector('french', "title" || ' ' || "description"));--> statement-breakpoint
CREATE INDEX "photo_listing_idx" ON "photos" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "offer_listing_status_idx" ON "offers" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "offer_carrier_status_idx" ON "offers" USING btree ("carrier_id","status");--> statement-breakpoint
CREATE INDEX "offer_listing_price_idx" ON "offers" USING btree ("listing_id","price_cents");--> statement-breakpoint
CREATE UNIQUE INDEX "offer_one_live_per_carrier" ON "offers" USING btree ("listing_id","carrier_id") WHERE "offers"."status" <> 'withdrawn';--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_idx" ON "shipment_events" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_events_status_idx" ON "shipment_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipment_listing_idx" ON "shipments" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "shipment_shipper_idx" ON "shipments" USING btree ("shipper_id");--> statement-breakpoint
CREATE INDEX "shipment_carrier_idx" ON "shipments" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "shipment_driver_idx" ON "shipments" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "shipment_status_idx" ON "shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "participant_conversation_idx" ON "conversation_participants" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "participant_user_idx" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "message_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "review_target_idx" ON "reviews" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "review_author_idx" ON "reviews" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "review_listing_idx" ON "reviews" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "review_shipment_idx" ON "reviews" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "payment_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_stripe_pi_idx" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_shipment_idx" ON "payments" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payout_carrier_idx" ON "payouts" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "payout_shipment_idx" ON "payouts" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "payout_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "invoice_payment_idx" ON "invoices" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "invoice_user_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "search_query_idx" ON "search_analytics" USING btree ("query");--> statement-breakpoint
CREATE INDEX "search_user_idx" ON "search_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_created_idx" ON "search_analytics" USING btree ("created_at");