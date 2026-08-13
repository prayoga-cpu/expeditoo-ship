CREATE TYPE "public"."listing_size" AS ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL');--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "length" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "weight" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "size" "listing_size";