CREATE TYPE "public"."application_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "driver_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "application_status" DEFAULT 'PENDING' NOT NULL,
	"vehicle_type" text NOT NULL,
	"vehicle_plate" text NOT NULL,
	"license_number" text NOT NULL,
	"siret" text NOT NULL,
	"company_name" text,
	"proposal_rate" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_applications" ADD CONSTRAINT "driver_applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;