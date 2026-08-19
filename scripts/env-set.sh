#!/usr/bin/env bash
#
# Set one environment variable in Vercel for one or more scopes, via the
# Vercel CLI — the supported way to keep Development/Preview/Production
# genuinely separate instead of hand-editing them in the dashboard.
#
#   pnpm env:set STRIPE_SECRET_KEY production
#   pnpm env:set STRIPE_SECRET_KEY preview development
#
# Prompts for the value (hidden input, via `vercel env add`) rather than
# taking it as an argument, so a secret never lands in shell history.

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: pnpm env:set <KEY> <production|preview|development> [more scopes...]" >&2
  exit 1
fi

KEY="$1"; shift

for SCOPE in "$@"; do
  case "$SCOPE" in
    production|preview|development) ;;
    *) echo "❌ Unknown scope \"$SCOPE\" — use production, preview or development." >&2; exit 1 ;;
  esac
  echo "→ Removing any existing $KEY in $SCOPE (ignore \"not found\")…"
  npx vercel env rm "$KEY" "$SCOPE" --yes 2>/dev/null || true
  echo "→ Enter the value for $KEY in $SCOPE:"
  npx vercel env add "$KEY" "$SCOPE"
done
