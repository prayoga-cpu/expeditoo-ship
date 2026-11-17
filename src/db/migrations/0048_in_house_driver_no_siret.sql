-- An in-house Expeditoo driver (carriers.kind = 'private') is not a business: they have no
-- SIRET. The column stays UNIQUE, and Postgres lets any number of NULLs through.
-- docs/specs/driver_types_spec.md §3
ALTER TABLE "carriers" ALTER COLUMN "siret" DROP NOT NULL;
