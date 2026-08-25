-- Private storage for Expedion bordereaux and lot photos.
--
-- Hand-written for the same reason 0002-0007 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Expedion's uploads went to Firebase Storage under `users/<uid>/uploads/…`,
-- where the rule matched `request.auth.uid` against the path. The app moved to
-- Better Auth, `request.auth` became null for every account created since, and
-- every upload started failing closed — which hard-blocked the bordereau form,
-- whose submit button will not enable without a document URL.
--
-- The bytes now go to a private R2 bucket. This table is the indirection that
-- keeps the object key out of `expedion_quotes`: the quote stores
-- `/api/expedion/files/<id>`, and only a caller this table says owns the file
-- (or an admin) gets it resolved. A key in the quote column would be a bearer
-- token for a document carrying the buyer's name, address and declared value.
--
-- `owner_user_id` is deliberately not a foreign key to `user`: the legacy
-- shared-key path names a Firebase UID with no row there, and a dangling
-- reference must not stop a document being stored. `quote_id` IS nullable —
-- the client uploads at pick time, before the quote it may never file exists.

CREATE TABLE IF NOT EXISTS "expedion_files" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_user_id" text NOT NULL,
  "quote_id" text,
  "kind" text NOT NULL,
  "object_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "expedion_files"
    ADD CONSTRAINT "expedion_files_quote_id_expedion_quotes_id_fk"
    FOREIGN KEY ("quote_id") REFERENCES "public"."expedion_quotes"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expedion_file_owner_idx" ON "expedion_files" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expedion_file_quote_idx" ON "expedion_files" USING btree ("quote_id");
