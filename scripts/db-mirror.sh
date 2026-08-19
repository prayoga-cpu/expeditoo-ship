#!/usr/bin/env bash
#
# Mirror production into a development database, anonymised.
#
#   pnpm db:mirror
#
# Reads production strictly read-only (one pg_dump) and never writes to it.
# The restore leg refuses any target that is not an allow-listed development
# database, and the copy is scrubbed and then verified before the script
# reports success.
#
# Configuration (all in .env.local):
#   MIRROR_SOURCE_URL    the production DIRECT (5432) url. A different
#                        variable name than POSTGRES_URL on purpose, so it
#                        can't become the app's own connection string by typo.
#   POSTGRES_URL         the target, unless MIRROR_TARGET_URL is exported.
#   MIRROR_KEEP_EMAILS   Comma-separated accounts to leave readable (normally
#                        your own), so you can still find yourself in the UI.
#
# See docs/specs/environments_spec.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

KEEP_DUMP=0
for arg in "$@"; do
  case "$arg" in
    --keep-dump) KEEP_DUMP=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

# --- Postgres 17 client tools -----------------------------------------------
# Production runs 17.x and pg_dump refuses a server newer than itself, so the
# 14.x psql on PATH is not enough. Pick the newest pg_dump available.
find_pg_bin() {
  local best="" best_major=0
  for dir in \
    /opt/homebrew/opt/postgresql@17/bin \
    /opt/homebrew/opt/libpq/bin \
    /usr/local/opt/postgresql@17/bin \
    /usr/local/opt/libpq/bin \
    "$(dirname "$(command -v pg_dump 2>/dev/null || echo /nonexistent/x)")"
  do
    [ -x "$dir/pg_dump" ] || continue
    local major
    major="$("$dir/pg_dump" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
    if [ "$major" -gt "$best_major" ]; then best_major=$major; best="$dir"; fi
  done
  [ -n "$best" ] || { echo "❌ No pg_dump found. brew install postgresql@17" >&2; exit 1; }
  echo "$best"
}

PG_BIN="$(find_pg_bin)"
PG_DUMP="$PG_BIN/pg_dump"
PG_RESTORE="$PG_BIN/pg_restore"
PSQL="$PG_BIN/psql"

# --- Resolve source and target ----------------------------------------------
read_env_var() {
  # Pull one KEY=value out of an env file without sourcing it, so a stray
  # command substitution in a secret cannot execute.
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  sed -nE "s/^[[:space:]]*(export[[:space:]]+)?${key}=[\"']?(.*[^\"'])[\"']?[[:space:]]*$/\2/p" "$file" | tail -1
}

SOURCE_URL="${MIRROR_SOURCE_URL:-$(read_env_var .env.local MIRROR_SOURCE_URL)}"
TARGET_URL="${MIRROR_TARGET_URL:-$(read_env_var .env.local POSTGRES_URL)}"
KEEP_EMAILS="${MIRROR_KEEP_EMAILS:-$(read_env_var .env.local MIRROR_KEEP_EMAILS)}"

if [ -z "${SOURCE_URL:-}" ]; then
  cat >&2 <<'MSG'
❌ MIRROR_SOURCE_URL is not set.

Add to .env.local (gitignored) the production DIRECT url:

  MIRROR_SOURCE_URL=postgresql://postgres.<ref>:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
  MIRROR_KEEP_EMAILS=you@example.com

Get it from Supabase → Project Settings → Database → Connection string (Session).
MSG
  exit 1
fi

if [ -z "${TARGET_URL:-}" ]; then
  echo "❌ No target database. Set POSTGRES_URL in .env.local (see .env.example)." >&2
  exit 1
fi

if [ "$SOURCE_URL" = "$TARGET_URL" ]; then
  echo "❌ Source and target are the same database. Refusing." >&2
  exit 1
fi

# --- Refuse a target that is not a known development database ---------------
# Delegated to the same TypeScript guard the app and migrations use, so there
# is exactly one definition of "safe to write to".
POSTGRES_URL="$TARGET_URL" POSTGRES_URL_NON_POOLING="$TARGET_URL" \
  npx --no-install tsx scripts/guard-db.ts "restore a production mirror into"

DUMP_FILE="$(mktemp "${TMPDIR:-/tmp}/expeditoo-mirror-XXXXXX.dump")"
cleanup() { [ "$KEEP_DUMP" -eq 1 ] || rm -f "$DUMP_FILE"; }
trap cleanup EXIT

# --- 1. Read production (read-only) -----------------------------------------
echo "📤 Dumping production…"
"$PG_DUMP" "$SOURCE_URL" \
  --format=custom \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-publications \
  --no-subscriptions \
  --file="$DUMP_FILE"
echo "   $(du -h "$DUMP_FILE" | cut -f1) dumped"

# --- 2. Replace the target's public schema ----------------------------------
# Drop only — do not recreate. `pg_dump --schema=public` embeds its own
# `CREATE SCHEMA public;` in the archive (dumping a named schema can't assume
# it already exists on the target), so pre-creating it here made pg_restore
# fail with "schema public already exists".
echo "🧨 Dropping the target schema…"
"$PSQL" "$TARGET_URL" --quiet --set ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA IF EXISTS public CASCADE;'

echo "📥 Restoring…"
# pg_restore reports benign noise (extension comments Supabase owns and we do
# not) so its exit status is inspected rather than trusted to be zero.
set +e
"$PG_RESTORE" --dbname="$TARGET_URL" --no-owner --no-privileges --exit-on-error "$DUMP_FILE"
RESTORE_STATUS=$?
set -e
if [ $RESTORE_STATUS -ne 0 ]; then
  echo "❌ Restore failed (exit $RESTORE_STATUS). The target is left empty on purpose." >&2
  exit $RESTORE_STATUS
fi

# --- 3. Scrub, then prove the scrub landed ----------------------------------
echo "🧼 Anonymising…"
"$PSQL" "$TARGET_URL" --quiet --set ON_ERROR_STOP=1 \
  -v keep_emails="$(echo "${KEEP_EMAILS:-}" | tr '[:upper:]' '[:lower:]')" \
  -f scripts/sql/anonymize.sql

"$PSQL" "$TARGET_URL" --set ON_ERROR_STOP=1 \
  -v keep_emails="$(echo "${KEEP_EMAILS:-}" | tr '[:upper:]' '[:lower:]')" \
  -f scripts/sql/verify-anonymized.sql

# --- 4. Restore sign-in ------------------------------------------------------
# The scrub above wipes every password hash it copies, including the ones
# belonging to MIRROR_KEEP_EMAILS accounts — real hashes are crackable and
# have no business on a dev machine. This puts a known dev password back on
# both the fixed dev accounts and any kept account, so a scheduled mirror
# leaves you with a working sign-in rather than a locked one.
echo "🔑 Restoring sign-in…"
MIRROR_KEEP_EMAILS="$KEEP_EMAILS" POSTGRES_URL="$TARGET_URL" \
  npx --no-install tsx src/scripts/seed-dev-users.ts

# --- 5. Summary --------------------------------------------------------------
echo
"$PSQL" "$TARGET_URL" --quiet -c "
  SELECT relname AS table, n_live_tup AS approx_rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'public' AND n_live_tup > 0
  ORDER BY n_live_tup DESC
  LIMIT 15;"

echo "✅ Mirror complete — anonymised copy restored, sign-in accounts unlocked."
