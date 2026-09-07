#!/usr/bin/env bash
# Deploy apps/web to Vercel: push env vars from apps/web/.env.local, then
# deploy production. Reusable and idempotent.
#
#   VERCEL_TOKEN comes from .deploy.env at the repo root (gitignored).
#   Usage: scripts/deploy-web.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
set -a; . ./.deploy.env; set +a
: "${VERCEL_TOKEN:?VERCEL_TOKEN missing in .deploy.env}"

TEAM="team_7eMDd9oqt7tD2mZPKQuQ0BFS"
PROJECT="bitshelf"
ENV_FILE="apps/web/.env.local"

# the server-side secrets and public keys the web app needs at runtime/build
KEYS=(
  DATABASE_URL
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  CLERK_SECRET_KEY
  ANTHROPIC_API_KEY
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET
  R2_PUBLIC_BASE_URL
)

echo "==> syncing env vars to Vercel project $PROJECT"
for key in "${KEYS[@]}"; do
  value=$(grep -m1 "^${key}=" "$ENV_FILE" | cut -d= -f2- | sed 's/^"//; s/"$//')
  if [ -z "$value" ]; then
    echo "  skip $key (not in $ENV_FILE)"
    continue
  fi
  # json-encode the value only, then send with curl (python urllib fails
  # SSL verification on this machine's python.org build; curl is fine)
  payload=$(python3 -c "import json,sys;print(json.dumps({'key':sys.argv[1],'value':sys.argv[2],'type':'encrypted','target':['production','preview']}))" "$key" "$value")
  curl -s -o /dev/null -X POST \
    "https://api.vercel.com/v10/projects/$PROJECT/env?teamId=$TEAM&upsert=true" \
    -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
    -d "$payload"
  echo "  set $key"
done

echo "==> deploying production"
npx --yes vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN"
