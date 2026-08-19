#!/usr/bin/env bash
# Read-only: list what's configured in each Vercel environment scope, without
# revealing values (`vercel env ls` never prints them).
set -euo pipefail
echo "=== production ==="; npx vercel env ls production
echo; echo "=== preview ==="; npx vercel env ls preview
echo; echo "=== development ==="; npx vercel env ls development
