-- Prove the scrub actually landed. Run by scripts/db-mirror.sh straight after
-- anonymize.sql, with the same `-v keep_emails=...` it uses; a single leaked
-- row aborts with a non-zero exit so a half-scrubbed mirror can never be
-- mistaken for a clean one.

\set ON_ERROR_STOP on

-- psql does not interpolate `:'var'` inside a dollar-quoted (`$$...$$`) DO
-- block body, so the substitution happens here instead, same as
-- anonymize.sql's `_keep_emails` — then the DO block below reads the table.
CREATE TEMP TABLE _keep_emails AS
SELECT lower(trim(value)) AS email
FROM unnest(string_to_array(:'keep_emails', ',')) AS value
WHERE trim(value) <> '';

DO $$
DECLARE
  keep text[] := ARRAY(SELECT email FROM _keep_emails);
  leaks text[] := ARRAY[]::text[];
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM "user"
   WHERE email NOT LIKE '%@dev.invalid'
     AND lower(email) <> ALL (COALESCE(keep, ARRAY[]::text[]));
  IF n > 0 THEN leaks := leaks || format('user.email: %s rows', n); END IF;

  -- anonymize.sql exempts a kept account's quotes from this UPDATE entirely
  -- (firebase_uid has to survive unchanged — see its comment there), so this
  -- check excludes them the same way the email check above does.
  SELECT count(*) INTO n FROM "expedion_quotes"
   WHERE (email NOT LIKE '%@dev.invalid'
      OR airtable_fields IS NOT NULL
      OR extraction IS NOT NULL)
     AND (email IS NULL OR lower(email) <> ALL (COALESCE(keep, ARRAY[]::text[])));
  IF n > 0 THEN leaks := leaks || format('expedion_quotes: %s rows', n); END IF;

  SELECT count(*) INTO n FROM "account"
   WHERE password IS NOT NULL
      OR access_token IS NOT NULL
      OR refresh_token IS NOT NULL;
  IF n > 0 THEN leaks := leaks || format('account credentials: %s rows', n); END IF;

  SELECT count(*) INTO n FROM "carrier_documents"
   WHERE object_key NOT LIKE 'kyc/dev-placeholder/%';
  IF n > 0 THEN leaks := leaks || format('carrier_documents.object_key: %s rows', n); END IF;

  SELECT count(*) INTO n FROM "payments"
   WHERE stripe_payment_intent_id IS NOT NULL
      OR stripe_checkout_session_id IS NOT NULL;
  IF n > 0 THEN leaks := leaks || format('payments stripe ids: %s rows', n); END IF;

  SELECT count(*) INTO n FROM "payouts" WHERE stripe_transfer_id IS NOT NULL;
  IF n > 0 THEN leaks := leaks || format('payouts.stripe_transfer_id: %s rows', n); END IF;

  -- anonymize.sql deliberately leaves a kept account's row untouched
  -- (image/stripe ids included) — see its "Users" section — so this check
  -- excludes them the same way the email check above does.
  SELECT count(*) INTO n FROM "user"
   WHERE (stripe_customer_id IS NOT NULL OR stripe_account_id IS NOT NULL)
     AND lower(email) <> ALL (COALESCE(keep, ARRAY[]::text[]));
  IF n > 0 THEN leaks := leaks || format('user stripe ids: %s rows', n); END IF;

  SELECT count(*) INTO n FROM "session";
  IF n > 0 THEN leaks := leaks || format('session: %s rows', n); END IF;

  SELECT count(*) INTO n FROM "impersonation_sessions";
  IF n > 0 THEN leaks := leaks || format('impersonation_sessions: %s rows', n); END IF;

  SELECT count(*) INTO n FROM "shipments" WHERE proof_of_delivery_url IS NOT NULL;
  IF n > 0 THEN leaks := leaks || format('shipments.proof_of_delivery_url: %s rows', n); END IF;

  IF array_length(leaks, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Anonymisation incomplete: %', array_to_string(leaks, '; ');
  END IF;

  RAISE NOTICE 'Anonymisation verified: no production personal data remains.';
END $$;
