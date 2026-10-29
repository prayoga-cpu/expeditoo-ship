-- REQ-02 of the driver field test (client_feedback_2026_10_29_spec.md §REQ-02):
-- a driver is Actif, Suspendu, Absent or Désinscrit.
--
-- « Actif » is the existing `approved`, relabelled; « Suspendu » is the
-- existing `suspended`. « Désinscrit » is a new status, appended like 0023's
-- and 0025's values — nothing sorts by `carrier_status`, it is read by
-- equality — and unused in this migration, so `ADD VALUE` inside the
-- migrator's transaction is safe.
--
-- « Absent » is deliberately *not* a status. An absence ends on a date, and a
-- status would need a sweep to flip it back — the sweeps have never run in
-- production (X1). Two columns instead: absent while `absent_since` is set and
-- `absent_until` is either unset or still ahead, so it ends by itself. The
-- carrier stays `approved` throughout, which is what keeps their live runs,
-- their payouts and their documents exactly as they were.
--
-- All nullable, nothing to backfill: no carrier is absent or deregistered yet.

ALTER TYPE "public"."carrier_status" ADD VALUE IF NOT EXISTS 'deregistered';--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "absent_since" timestamp;--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "absent_until" timestamp;--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "absence_reason" text;--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "deregistered_at" timestamp;--> statement-breakpoint
ALTER TABLE "carriers" ADD COLUMN IF NOT EXISTS "deregistration_reason" text;
