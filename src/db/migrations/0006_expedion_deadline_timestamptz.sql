-- The five Expedion deadline columns become `timestamptz`.
--
-- Hand-written for the same reason 0002-0005 were: 0002 left no snapshot, so
-- `drizzle-kit generate` would diff against 0001 and re-emit the whole
-- transport realignment on a database that already has it.
--
-- Why: these columns are written from JS and compared against SQL `now()`
-- (`ESCALATION_DUE` and `storageAtRisk` in `expedion-report.dal.ts`). As a
-- naked `timestamp` the two disagree — Drizzle sends a `Date` as its UTC
-- wall-clock, `now()` is evaluated in the session time zone — so on a server
-- at UTC+8 every paid quote read as escalation-due eight hours early, while
-- `findDueForEscalation` (which compares against a JS `Date`, not `now()`)
-- stayed correct. The cron and the dashboard disagreed about the same row.
--
-- `AT TIME ZONE 'UTC'` is the right reading of the existing values: every one
-- of these five is written from application code and none has a database
-- default, so what is stored is already a UTC wall-clock.
--
-- Each statement is guarded on the column still being `timestamp without time
-- zone`. Drizzle's journal already stops a migration re-running, but this one
-- is not naturally idempotent: applied twice on a non-UTC session it would
-- shift every value by the session offset a second time, silently. A guard is
-- cheaper than trusting that nobody ever replays it by hand.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedion_quotes' AND column_name = 'sale_date'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "expedion_quotes"
      ALTER COLUMN "sale_date" TYPE timestamptz
      USING "sale_date" AT TIME ZONE 'UTC';
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedion_quotes' AND column_name = 'assigned_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "expedion_quotes"
      ALTER COLUMN "assigned_at" TYPE timestamptz
      USING "assigned_at" AT TIME ZONE 'UTC';
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedion_quotes' AND column_name = 'escalated_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "expedion_quotes"
      ALTER COLUMN "escalated_at" TYPE timestamptz
      USING "escalated_at" AT TIME ZONE 'UTC';
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedion_quotes' AND column_name = 'escalate_after'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "expedion_quotes"
      ALTER COLUMN "escalate_after" TYPE timestamptz
      USING "escalate_after" AT TIME ZONE 'UTC';
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedion_quotes' AND column_name = 'storage_free_until'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE "expedion_quotes"
      ALTER COLUMN "storage_free_until" TYPE timestamptz
      USING "storage_free_until" AT TIME ZONE 'UTC';
  END IF;
END $$;
