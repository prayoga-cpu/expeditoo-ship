#!/usr/bin/env bash
# Local dev cache housekeeping for expeditoo-ship + its Expedion sibling repo.
# Only touches rebuildable caches (Next.js, node_modules, graphify's extraction
# cache and leftover temp files) — never source, never the committed
# graphify-out/graph.json or GRAPH_REPORT.md. Safe to run anytime.
set -euo pipefail

clean_repo() {
  local repo="$1"
  [ -d "$repo" ] || return 0
  echo "Cleaning caches in $repo"
  rm -rf "$repo/.next" "$repo/node_modules/.cache" "$repo/graphify-out/cache" "$repo/.dart_tool" "$repo/build"
  find "$repo/graphify-out" -maxdepth 1 -name '.graphify_chunk_*.json' -delete 2>/dev/null || true
}

SHIP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENCHERES_DIR="$(cd "$SHIP_DIR/../expedion_encheres" 2>/dev/null && pwd || true)"

clean_repo "$SHIP_DIR"
[ -n "$ENCHERES_DIR" ] && clean_repo "$ENCHERES_DIR"

echo "Done."
