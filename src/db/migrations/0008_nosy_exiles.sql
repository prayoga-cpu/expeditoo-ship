CREATE TYPE "public"."review_role" AS ENUM('buyer', 'seller', 'driver', 'client');--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "listing_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "stripe_account_status" "stripe_account_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "shipment_id" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "role" "review_role" NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "application_fee_amount" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "transfer_group" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_shipment_idx" ON "reviews" USING btree ("shipment_id");