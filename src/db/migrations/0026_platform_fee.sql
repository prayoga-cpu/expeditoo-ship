-- An admin-configurable platform fee, added on top of what the client is
-- charged at award time — additive, distinct from `payments.commission_cents`
-- (a cut taken from the *carrier's* side instead, unaffected by this).
--
-- `platform_settings` is a singleton: exactly one row, primary key "default",
-- upserted by `platformSettingsService.update`. `fee_basis_points` defaults to
-- 0 so nothing changes for an existing deployment until an admin sets it.
--
-- `payments.platform_fee_cents` and `invoices.platform_fee_cents` both
-- default to 0 and are NOT NULL: every row before this migration genuinely
-- had a zero fee, and every existing insert call site that does not set the
-- column explicitly keeps working unchanged.

CREATE TABLE IF NOT EXISTS "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"fee_basis_points" integer DEFAULT 0 NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint
INSERT INTO "platform_settings" ("id", "fee_basis_points") VALUES ('default', 0) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "platform_fee_cents" integer DEFAULT 0 NOT NULL;
