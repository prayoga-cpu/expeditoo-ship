-- Scrub a production mirror so no real personal data survives in development.
--
-- Runs against the TARGET (development) database only — scripts/db-mirror.sh
-- refuses to invoke it against anything that is not an allow-listed dev
-- database. Everything is one transaction: either the copy is fully scrubbed
-- or it is left untouched for you to retry.
--
-- What is deliberately KEPT, because dev is useless without it:
--   * row counts, ids, foreign keys, timestamps, statuses, money amounts
--   * listing titles and goods descriptions (they describe parcels, not people)
--   * listing photo URLs (already world-readable objects)
--   * city names and coordinates rounded to ~1 km
--
-- What is destroyed: names, emails, phones, street addresses, KYC document
-- keys, avatars, proof-of-delivery photos, free-text people write to each
-- other, every credential and every live third-party id.
--
-- :keep_emails is a comma-separated allow-list of accounts to leave readable
-- (normally your own), passed by the mirror script.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _keep_emails ON COMMIT DROP AS
SELECT lower(trim(value)) AS email
FROM unnest(string_to_array(:'keep_emails', ',')) AS value
WHERE trim(value) <> '';

-- ---------------------------------------------------------------------------
-- Credentials and live sessions. Dropped outright rather than rewritten: a
-- mirrored session token is a working key to a production account.
-- ---------------------------------------------------------------------------
TRUNCATE TABLE "session";
TRUNCATE TABLE "verification";
TRUNCATE TABLE "impersonation_sessions";
TRUNCATE TABLE "search_analytics";

UPDATE "account"
SET access_token = NULL,
    refresh_token = NULL,
    id_token = NULL,
    scope = NULL,
    -- Password hashes are crackable and belong to real people. Local sign-in
    -- comes from `pnpm db:seed:dev-users`, not from mirrored credentials.
    password = NULL;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
UPDATE "user" u
SET name = 'Dev User ' || right(u.id, 6),
    email = 'user-' || u.id || '@dev.invalid',
    image = NULL,
    stripe_customer_id = NULL,
    stripe_account_id = NULL
WHERE lower(u.email) NOT IN (SELECT email FROM _keep_emails);

-- ---------------------------------------------------------------------------
-- Addresses. The département (first two digits of the postcode) is preserved
-- because French routing and pricing logic keys off it.
-- ---------------------------------------------------------------------------
UPDATE "addresses"
SET label = 'Dev address',
    street = right(id, 3) || ' rue de Développement',
    zip = COALESCE(left(zip, 2), '75') || '000',
    details = NULL,
    lat = round(lat::numeric, 2)::double precision,
    lng = round(lng::numeric, 2)::double precision;

-- ---------------------------------------------------------------------------
-- Carriers. SIRET is replaced with INSEE's published example value, which is
-- Luhn-valid, so french-identifiers.ts validation still passes.
-- ---------------------------------------------------------------------------
UPDATE "carriers"
SET company_name = 'Dev Carrier ' || right(id, 6),
    siret = '73282932000074',
    vat_number = NULL,
    contact_phone = '+3360000' || lpad((abs(hashtext(id)) % 10000)::text, 4, '0'),
    address_line = right(id, 3) || ' rue de Développement',
    postal_code = COALESCE(left(postal_code, 2), '75') || '000',
    iban_last4 = '0000',
    bic_last4 = '0000',
    stripe_account_id = NULL,
    bio = CASE WHEN bio IS NULL THEN NULL ELSE 'Dev bio.' END,
    rejection_reason = CASE WHEN rejection_reason IS NULL THEN NULL ELSE 'Dev rejection reason.' END,
    suspension_reason = CASE WHEN suspension_reason IS NULL THEN NULL ELSE 'Dev suspension reason.' END;

-- Identity documents. The key is what the presigned-URL path resolves, so a
-- real one would let a dev machine pull a real passport scan out of prod R2.
UPDATE "carrier_documents"
SET object_key = 'kyc/dev-placeholder/' || id,
    rejection_reason = CASE WHEN rejection_reason IS NULL THEN NULL ELSE 'Dev rejection reason.' END;

UPDATE "vehicles"
SET plate_number = 'AA-' || lpad((abs(hashtext(id)) % 1000)::text, 3, '0') || '-AA';

-- ---------------------------------------------------------------------------
-- Expedion quotes — the widest PII surface in the schema. `airtable_fields`
-- and `extraction` are raw client payloads, so they go entirely.
--
-- Kept accounts are excluded from this UPDATE entirely (not just email/name,
-- like the "user" table above) — `firebase_uid` in particular has to survive
-- unchanged, because the Expedion Flutter client authenticates with a real
-- Firebase ID token and expeditoo-ship looks up "my quotes" by matching that
-- token's uid against this column (`src/lib/expedion-auth.ts`). Rewriting it
-- for a kept account would sever the exact link `MIRROR_KEEP_EMAILS` exists
-- to preserve — the local Expedion app would show "no quotes" for an account
-- that, in production, has plenty.
-- ---------------------------------------------------------------------------
UPDATE "expedion_quotes"
SET airtable_record_id = NULL,
    airtable_fields = NULL,
    -- NOT NULL column — a real external identity, so still destroyed, but
    -- replaced rather than nulled.
    firebase_uid = 'dev:' || id,
    bordereau_doc_url = NULL,
    photo_urls = NULL,
    extraction = NULL,
    first_name = 'Dev',
    last_name = 'Client ' || right(id, 6),
    email = 'quote-' || id || '@dev.invalid',
    phone = '+3360000' || lpad((abs(hashtext(id)) % 10000)::text, 4, '0'),
    client_address = right(id, 3) || ' rue de Développement',
    client_postal_code = COALESCE(left(client_postal_code, 2), '75') || '000',
    auction_house_name = CASE WHEN auction_house_name IS NULL THEN NULL ELSE 'Dev Auction House' END,
    pickup_address = right(id, 3) || ' rue de Départ',
    pickup_postal_code = COALESCE(left(pickup_postal_code, 2), '75') || '000',
    pickup_phone = '+3360000' || lpad((abs(hashtext(id || 'p')) % 10000)::text, 4, '0'),
    pickup_lat = round(pickup_lat::numeric, 2)::double precision,
    pickup_lng = round(pickup_lng::numeric, 2)::double precision,
    recipient_name = 'Dev Recipient ' || right(id, 6),
    delivery_address = right(id, 3) || ' rue d''Arrivée',
    delivery_address_line2 = NULL,
    delivery_postal_code = COALESCE(left(delivery_postal_code, 2), '75') || '000',
    delivery_phone = '+3360000' || lpad((abs(hashtext(id || 'd')) % 10000)::text, 4, '0'),
    delivery_lat = round(delivery_lat::numeric, 2)::double precision,
    delivery_lng = round(delivery_lng::numeric, 2)::double precision,
    comment = CASE WHEN comment IS NULL THEN NULL ELSE 'Dev comment.' END
WHERE email IS NULL
   OR lower(trim(email)) NOT IN (SELECT email FROM _keep_emails);

UPDATE "expedion_quote_events"
SET message = CASE WHEN message IS NULL THEN NULL ELSE 'Dev event message.' END,
    metadata = NULL;

-- ---------------------------------------------------------------------------
-- Jobs and execution
-- ---------------------------------------------------------------------------
UPDATE "listings"
SET pickup_address = right(id, 3) || ' rue de Départ',
    pickup_postal_code = COALESCE(left(pickup_postal_code, 2), '75') || '000',
    pickup_lat = round(pickup_lat::numeric, 2)::double precision,
    pickup_lng = round(pickup_lng::numeric, 2)::double precision,
    dropoff_address = right(id, 3) || ' rue d''Arrivée',
    dropoff_postal_code = COALESCE(left(dropoff_postal_code, 2), '75') || '000',
    dropoff_lat = round(dropoff_lat::numeric, 2)::double precision,
    dropoff_lng = round(dropoff_lng::numeric, 2)::double precision;

UPDATE "shipments"
SET pickup_address = right(id, 3) || ' rue de Départ',
    pickup_lat = round(pickup_lat::numeric, 2)::double precision,
    pickup_lng = round(pickup_lng::numeric, 2)::double precision,
    dropoff_address = right(id, 3) || ' rue d''Arrivée',
    dropoff_lat = round(dropoff_lat::numeric, 2)::double precision,
    dropoff_lng = round(dropoff_lng::numeric, 2)::double precision,
    -- Delivery photos show doorways, faces and house numbers.
    proof_of_delivery_url = NULL,
    cancellation_reason = CASE WHEN cancellation_reason IS NULL THEN NULL ELSE 'Dev cancellation reason.' END;

UPDATE "shipment_events"
SET note = CASE WHEN note IS NULL THEN NULL ELSE 'Dev note.' END,
    metadata = NULL;

UPDATE "offers"
SET message = CASE WHEN message IS NULL THEN NULL ELSE 'Dev offer message.' END;

-- ---------------------------------------------------------------------------
-- Anything people wrote to each other
-- ---------------------------------------------------------------------------
UPDATE "messages"
SET content = 'Dev message.',
    attachment_url = NULL;

UPDATE "notifications"
SET title = 'Dev notification',
    message = 'Dev notification body.',
    data = NULL;

UPDATE "reviews"
SET comment = CASE WHEN comment IS NULL THEN NULL ELSE 'Dev review comment.' END;

-- ---------------------------------------------------------------------------
-- Money. Every id here addresses a real object in the live Stripe account, so
-- a dev process holding one could act on production money.
-- ---------------------------------------------------------------------------
UPDATE "payments"
SET stripe_payment_intent_id = NULL,
    stripe_checkout_session_id = NULL,
    transfer_group = NULL,
    failure_reason = CASE WHEN failure_reason IS NULL THEN NULL ELSE 'Dev failure reason.' END;

UPDATE "payouts"
SET stripe_transfer_id = NULL,
    failure_reason = CASE WHEN failure_reason IS NULL THEN NULL ELSE 'Dev failure reason.' END;

UPDATE "invoices"
SET pdf_url = NULL;

COMMIT;
