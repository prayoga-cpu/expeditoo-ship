-- The company's legal identity, entered by an admin at /admin/settings rather
-- than as deployment variables (launch_readiness_spec.md §A). One row; every
-- column nullable, because none of it may be invented.
CREATE TABLE IF NOT EXISTS "company_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"legal_name" text,
	"legal_form" text,
	"capital" text,
	"address" text,
	"siret" text,
	"rcs" text,
	"vat_number" text,
	"vat_rate" text,
	"billing_email" text,
	"publication_director" text,
	"host" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_identity" ADD CONSTRAINT "company_identity_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- The last Stripe event whose signature this app verified (§B), so the admin
-- can see the webhook arriving without opening the Stripe dashboard.
CREATE TABLE IF NOT EXISTS "stripe_webhook_heartbeat" (
	"id" text PRIMARY KEY NOT NULL,
	"last_event_at" timestamp NOT NULL,
	"last_event_type" text NOT NULL,
	"last_event_livemode" boolean NOT NULL
);
