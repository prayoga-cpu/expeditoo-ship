#!/usr/bin/env bash
#
# Wrapper for the scheduled (launchd) daily mirror run.
#
# Unlike an interactive `pnpm db:mirror`, this runs unattended with no
# terminal to read output from, so everything is logged to a file instead,
# and it makes sure local Postgres is actually up first (a launchd job can
# fire before you've ever run `pnpm db:start` today).
#
# Installed/removed by scripts/install-daily-mirror.sh.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$HOME/Library/Logs/expeditoo-db-mirror"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d_%H-%M-%S).log"

{
  echo "=== db:mirror (daily) — $(date) ==="
  bash scripts/db-start.sh
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    echo "❌ db-start.sh failed (exit $STATUS) — aborting mirror"
    exit $STATUS
  fi

  bash scripts/db-mirror.sh
  STATUS=$?
  echo "=== finished — exit $STATUS — $(date) ==="
  exit $STATUS
} >> "$LOG_FILE" 2>&1

STATUS=$?
ln -sf "$LOG_FILE" "$LOG_DIR/latest.log"

# Keep 30 days of daily logs; this job creates one per run.
find "$LOG_DIR" -maxdepth 1 -name "*.log" -mtime +30 -delete

exit $STATUS
