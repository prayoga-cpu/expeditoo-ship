-- The sign-up form asks for first and last name separately, and an optional
-- alias (client_feedback_2026_10_spec.md §1). `name` stays as it is — the
-- display string — so nothing is back-filled: accounts created before keep
-- null parts until their owner fills them in on /profile.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "first_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "alias" text;--> statement-breakpoint
-- A person's own phone and a relative's (§7b). Its own table, so no join that
-- loads a whole "user" row can carry a third party's number.
CREATE TABLE IF NOT EXISTS "user_contact_details" (
	"user_id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"relative_name" text,
	"relative_phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_contact_details" ADD CONSTRAINT "user_contact_details_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
