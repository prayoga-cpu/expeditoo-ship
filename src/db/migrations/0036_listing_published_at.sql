-- The moment a request first went live, separate from when it was written.
-- A draft finished days later, or a scheduled request the scheduler publishes,
-- was sorted and labelled by the day it was saved (`created_at`) — so the
-- board's « Plus récentes » buried it and « Publiée le » said the wrong day.
-- See docs/specs/draft_requests_spec.md §5.
--
-- Nullable: a draft or a scheduled request has not gone live. Back-filled with
-- `created_at` for every row that is neither — before this column, a request
-- went live when it was created, except a scheduled one, whose real moment was
-- not recorded and is best approximated the same way. That also stamps the few
-- rows that never went live at all: a scheduled request the scheduler expired
-- because its bidding window had closed, or one cancelled while still
-- scheduled. Nothing on such a row tells it apart from one that was live, so
-- they cannot be left out. From here on those paths leave the column null.

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "published_at" timestamp;--> statement-breakpoint
UPDATE "listings" SET "published_at" = "created_at" WHERE "published_at" IS NULL AND "status" NOT IN ('draft', 'scheduled');
