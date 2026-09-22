-- "Publish now, or schedule for later": a listing whose requester chose a
-- future go-live instant sits as `scheduled` rather than `open` until the
-- publish-scheduled-listings cron (`listingsService.publishScheduled`,
-- mirroring `expireDueListings`) flips it once `scheduled_publish_at` arrives.
-- An Expedion-escalated job is posted prepaid and always goes live
-- immediately (`expedion-escalation.service.ts`), so it is never `scheduled`.
--
-- `scheduled_publish_at` nullable throughout, same as `reopened_at`: every row
-- before this migration published immediately or never, so there is nothing
-- to backfill, and every status other than `scheduled` simply never sets it.
--
-- Appended rather than declared in place, same as 0023's `app` value:
-- Postgres orders an enum by declaration order, but nothing here sorts by
-- `listing_status` — it is read by equality (`eq(listings.status, ...)`) and
-- rendered by label.

ALTER TYPE "public"."listing_status" ADD VALUE IF NOT EXISTS 'scheduled';--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "scheduled_publish_at" timestamp;
