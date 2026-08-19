#!/usr/bin/env bash
# Stop the local development PostgreSQL 17 cluster started by db-start.sh.
set -euo pipefail

PG_PREFIX="/opt/homebrew/opt/postgresql@17"
[ -d "$PG_PREFIX" ] || PG_PREFIX="/usr/local/opt/postgresql@17"
DATA_DIR="$(cd "$(dirname "$PG_PREFIX")" && pwd)/var/postgresql@17"

if [ -d "$DATA_DIR" ]; then
  "$PG_PREFIX/bin/pg_ctl" -D "$DATA_DIR" stop -m fast
else
  echo "Nothing to stop — no cluster at $DATA_DIR"
fi
