#!/usr/bin/env bash
#
# One-time setup of the dev environment's variables — Vercel (Preview scope)
# and GitHub — once the dashboards have been visited.
#
#   pnpm env:bootstrap:dev
#
# Before running (docs/plans/plan_dev_environment.md §5.A):
#   - Neon: a `dev` branch exists and its role password has been reset
#   - R2: the dev buckets exist
#   - Stripe (test mode): a webhook endpoint for https://dev.expeditop.fr/api/stripe/webhook
#   - Vercel → Storage → Neon: "Preview" is unticked, so the integration no
#     longer injects production's POSTGRES_URL into previews
#   - `vercel login` and `gh auth login` are done
#
# What it does: asks for the values only a dashboard can give, generates the
# rest, and writes them. Nothing is echoed and nothing is written to disk.
#
# It never passes --force. If a variable already exists in Preview the add
# fails and the script says so and moves on: overwriting is a decision, and a
# row stored for Production AND Preview must be split in the dashboard, not
# clobbered from here.

set -euo pipefail

PRODUCTION_DB_REF="ep-sweet-bonus-awtyfuyz" # src/lib/db-target.ts
DEV_ORIGIN="https://dev.expeditop.fr"
DEV_BRANCH="dev"

command -v vercel >/dev/null || { echo "❌ vercel CLI not found (npm i -g vercel)." >&2; exit 1; }
command -v gh >/dev/null || { echo "❌ gh CLI not found." >&2; exit 1; }
vercel whoami >/dev/null 2>&1 || { echo "❌ Not signed in to Vercel — run: vercel login" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ Not signed in to GitHub — run: gh auth login" >&2; exit 1; }
[ -f .vercel/project.json ] || { echo "❌ Not linked — run: vercel link" >&2; exit 1; }

ask_secret() { # ask_secret VAR "prompt"
  local value
  read -r -s -p "$2: " value; echo >&2
  [ -n "$value" ] || { echo "❌ Empty value." >&2; exit 1; }
  printf -v "$1" '%s' "$value"
}

ask() { # ask VAR "prompt" "default"
  local value
  read -r -p "$2 [$3]: " value
  printf -v "$1" '%s' "${value:-$3}"
}

endpoint_of() { # the Neon endpoint id in a connection string, without -pooler
  printf '%s' "$1" | sed -E 's#^[a-z]+://[^@]*@([^./:]+).*#\1#; s#-pooler$##'
}

FAILED=()

vset() { # vset KEY VALUE [--git-branch NAME]
  local key="$1" value="$2"; shift 2
  if printf '%s' "$value" | vercel env add "$key" preview "$@" --sensitive --yes >/dev/null 2>&1; then
    echo "  ✓ vercel preview  $key"
  else
    echo "  ✗ vercel preview  $key — already set, or refused" >&2
    FAILED+=("$key")
  fi
}

echo "— Values from the dashboards —"
ask_secret DEV_POOLED "Neon dev branch, POOLED connection string"
ask_secret DEV_DIRECT "Neon dev branch, DIRECT connection string"
ask_secret STRIPE_WHSEC "Stripe TEST-mode webhook signing secret (whsec_…)"
ask_secret DEV_PASSWORD "Password for the seeded dev sign-in accounts"
ask R2_PUBLIC   "R2 public bucket"   "expeditop-dev"
ask R2_KYC      "R2 KYC bucket"      "expeditop-kyc-dev"
ask R2_SHIPMENT "R2 shipment bucket" "expeditop-shipments-dev"
ask DEV_MAIL    "Address that receives ALL mail sent by dev" "$(git config user.email)"

DEV_REF="$(endpoint_of "$DEV_DIRECT")"
POOLED_REF="$(endpoint_of "$DEV_POOLED")"

case "$DEV_REF" in ep-*) ;; *) echo "❌ Could not read a Neon endpoint id from the direct URL." >&2; exit 1 ;; esac
if [ "$DEV_REF" = "$PRODUCTION_DB_REF" ] || [ "$POOLED_REF" = "$PRODUCTION_DB_REF" ]; then
  echo "❌ That is the PRODUCTION endpoint ($PRODUCTION_DB_REF). Use the dev branch's URLs." >&2
  exit 1
fi
if [ "$DEV_REF" != "$POOLED_REF" ]; then
  echo "❌ The pooled and direct URLs name different endpoints ($POOLED_REF / $DEV_REF)." >&2
  exit 1
fi
case "$STRIPE_WHSEC" in whsec_*) ;; *) echo "❌ That is not a whsec_ secret." >&2; exit 1 ;; esac

CRON="$(openssl rand -hex 32)"

echo
echo "— Vercel, Preview scope —"
vset POSTGRES_URL             "$DEV_POOLED"
vset POSTGRES_URL_NON_POOLING "$DEV_DIRECT"
vset DEV_DB_REFS              "$DEV_REF"
vset BETTER_AUTH_SECRET       "$(openssl rand -hex 32)"
vset CRON_SECRET              "$CRON"
vset EXPEDION_API_KEY         "$(openssl rand -hex 32)"
vset EXPEDION_ADMIN_API_KEY   "$(openssl rand -hex 32)"
vset STRIPE_WEBHOOK_SECRET    "$STRIPE_WHSEC"
vset R2_BUCKET_NAME           "$R2_PUBLIC"
vset R2_KYC_BUCKET_NAME       "$R2_KYC"
vset R2_SHIPMENT_BUCKET_NAME  "$R2_SHIPMENT"
vset R2_PUBLIC_URL            "$DEV_ORIGIN/api/images"
vset EMAIL_DEV_RECIPIENT      "$DEV_MAIL"
vset NEXT_PUBLIC_APP_URL      "$DEV_ORIGIN" --git-branch "$DEV_BRANCH"

echo
echo "— GitHub —"
printf '%s' "$DEV_DIRECT"   | gh secret set POSTGRES_URL_DEV   && echo "  ✓ secret   POSTGRES_URL_DEV"
printf '%s' "$CRON"         | gh secret set CRON_SECRET_DEV    && echo "  ✓ secret   CRON_SECRET_DEV"
printf '%s' "$DEV_PASSWORD" | gh secret set DEV_USER_PASSWORD  && echo "  ✓ secret   DEV_USER_PASSWORD"
gh variable set DEV_DB_REFS --body "$DEV_REF"    >/dev/null && echo "  ✓ variable DEV_DB_REFS"
gh variable set APP_URL_DEV --body "$DEV_ORIGIN" >/dev/null && echo "  ✓ variable APP_URL_DEV"

echo
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "⚠️  Not written to Vercel: ${FAILED[*]}"
  echo "   Each already has a Preview value (or is still shared with Production)."
  echo "   Check with: pnpm env:list — then replace it in the dashboard."
  [[ " ${FAILED[*]} " == *" CRON_SECRET "* ]] && \
    echo "   CRON_SECRET in particular: GitHub now holds a NEW CRON_SECRET_DEV that Vercel does not."
  exit 1
fi

cat <<MSG
✅ Done. Still by hand:
   - GitHub secret MIRROR_SOURCE_URL (the mirror_readonly URL from .env.local)
   - GitHub secret VERCEL_TOKEN, for the weekly environment audit
   - then: Actions → "Refresh dev database", and push to \`$DEV_BRANCH\`.
MSG
