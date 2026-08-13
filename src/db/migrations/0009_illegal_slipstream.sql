CREATE TYPE "public"."earning_source" AS ENUM('sale', 'delivery', 'app_fee');--> statement-breakpoint
CREATE TYPE "public"."earning_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stripe_account_status" AS ENUM('pending', 'active', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "earnings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"source" "earning_source" NOT NULL,
	"status" "earning_status" DEFAULT 'completed' NOT NULL,
	"stripe_transfer_id" text,
	"description" text,
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
CREATE TABLE "transporter_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vehicle" jsonb NOT NULL,
	"service_zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"max_shipments_per_day" integer DEFAULT 5,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"completed_deliveries" integer DEFAULT 0 NOT NULL,
	"cancelled_deliveries" integer DEFAULT 0 NOT NULL,
	"average_rating" double precision DEFAULT 0 NOT NULL,
	"total_ratings" integer DEFAULT 0 NOT NULL,
	"total_earnings" integer DEFAULT 0 NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transporter_profiles_user_id_unique" UNIQUE("user_id")
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
ALTER TABLE "user" ALTER COLUMN "preferences" SET DEFAULT '{"notifications":{"email":{"auctionResults":true,"outbid":true,"orderConfirmation":true,"paymentConfirmation":true,"shipmentUpdates":true,"invoiceReady":true,"marketing":false,"security":true},"inApp":{"auctionResults":true,"outbid":true,"orderConfirmation":true,"paymentConfirmation":true,"shipmentUpdates":true,"invoiceReady":true,"messages":true}}}'::jsonb;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "length" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "width" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "height" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "rating" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "reputation_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings" ADD CONSTRAINT "earnings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transporter_profiles" ADD CONSTRAINT "transporter_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_analytics" ADD CONSTRAINT "search_analytics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "earning_user_idx" ON "earnings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "earning_order_idx" ON "earnings" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "earning_source_idx" ON "earnings" USING btree ("source");--> statement-breakpoint
CREATE INDEX "earning_created_idx" ON "earnings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invoice_payment_idx" ON "invoices" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "invoice_user_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "transporter_user_idx" ON "transporter_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transporter_available_idx" ON "transporter_profiles" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "transporter_rating_idx" ON "transporter_profiles" USING btree ("average_rating");--> statement-breakpoint
CREATE INDEX "search_query_idx" ON "search_analytics" USING btree ("query");--> statement-breakpoint
CREATE INDEX "search_user_idx" ON "search_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_created_idx" ON "search_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_rating_idx" ON "user" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "user_reputation_idx" ON "user" USING btree ("reputation_score");--> statement-breakpoint
CREATE INDEX "listing_search_idx" ON "listings" USING gin (to_tsvector('french', "title" || ' ' || "description"));