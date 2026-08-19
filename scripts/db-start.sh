#!/usr/bin/env bash
#
# Start (and, on first run, create) the local development PostgreSQL 17
# cluster + the `expeditoo_dev` database.
#
#   pnpm db:start
#
# Idempotent — safe to run whether or not the server is already up.

set -euo pipefail

PG_PREFIX="/opt/homebrew/opt/postgresql@17"
[ -d "$PG_PREFIX" ] || PG_PREFIX="/usr/local/opt/postgresql@17"
if [ ! -d "$PG_PREFIX" ]; then
  echo "❌ postgresql@17 not found. Install it: brew install postgresql@17" >&2
  exit 1
fi

DATA_DIR="${PGDATA:-$(dirname "$PG_PREFIX")/../var/postgresql@17}"
DATA_DIR="$(cd "$(dirname "$PG_PREFIX")" && pwd)/var/postgresql@17"
LOG_FILE="$(cd "$(dirname "$PG_PREFIX")" && pwd)/var/log/postgresql@17.log"

if [ ! -d "$DATA_DIR" ]; then
  echo "🆕 Initialising a new PostgreSQL 17 cluster at $DATA_DIR"
  mkdir -p "$(dirname "$LOG_FILE")"
  "$PG_PREFIX/bin/initdb" --locale=C -E UTF-8 "$DATA_DIR" >/dev/null
fi

if "$PG_PREFIX/bin/pg_isready" -h localhost -p 5432 -q; then
  echo "✅ PostgreSQL 17 already running on localhost:5432"
else
  echo "▶️  Starting PostgreSQL 17…"
  "$PG_PREFIX/bin/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" start
fi

if ! "$PG_PREFIX/bin/psql" -h localhost -p 5432 -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = 'expeditoo_dev'" | grep -q 1; then
  echo "🆕 Creating database expeditoo_dev"
  "$PG_PREFIX/bin/createdb" -h localhost -p 5432 expeditoo_dev
fi

echo "✅ expeditoo_dev is ready on postgresql://postgres@localhost:5432/expeditoo_dev"
echo "   Empty — run 'pnpm db:migrate' then either 'pnpm db:mirror' or 'pnpm db:seed:dev-users'."
