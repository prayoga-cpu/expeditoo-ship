-- What the carrier must do to the goods, beside how the goods already are
-- (`packaging_level`, 0027). Client feedback 2026-09-29: "Need to be
-- protected / Need to be packaged". See docs/specs/cargo_packaging_services_spec.md.
--
-- NOT NULL DEFAULT false, like is_fragile / needs_help: `false` means "not
-- requested", which is exactly true of every row that predates the columns —
-- unlike packaging_level, where absence must not be read as "unprotected".

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "needs_protection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "needs_packaging" boolean DEFAULT false NOT NULL;
