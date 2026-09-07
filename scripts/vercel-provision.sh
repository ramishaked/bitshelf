#!/usr/bin/env bash
# Provision a NEW Vercel project from the terminal, no dashboard.
# Creates the project, pushes env vars from a .env file, and deploys prod.
#
# Requires a Vercel token in $VERCEL_TOKEN, or a .deploy.env (gitignored)
# next to this script's repo root holding VERCEL_TOKEN=...
#
# Usage:
#   scripts/vercel-provision.sh <project-name> <root-dir> <env-file>
# Example:
#   scripts/vercel-provision.sh my-site apps/web apps/web/.env.local
set -euo pipefail

NAME="${1:?project name required}"
ROOT_DIR="${2:-.}"          # monorepo sub-dir to build (e.g. apps/web), or .
ENV_FILE="${3:-.env.local}" # file whose KEY=VALUE lines become prod env vars

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
if [ -z "${VERCEL_TOKEN:-}" ] && [ -f .deploy.env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.deploy.env; set +a
fi
: "${VERCEL_TOKEN:?set VERCEL_TOKEN or put it in .deploy.env}"

# discover the team (first team the token can see)
TEAM=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/teams \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['teams'][0]['id'])")
echo "==> team $TEAM"

# create the project (ignores 'already exists')
echo "==> creating project $NAME (root: $ROOT_DIR)"
curl -s -X POST "https://api.vercel.com/v11/projects?teamId=$TEAM" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'name':sys.argv[1],'framework':'nextjs','rootDirectory':sys.argv[2]}))" "$NAME" "$ROOT_DIR")" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('   ', d.get('error',{}).get('message','created '+str(d.get('id'))))"

# push each KEY=VALUE from the env file to production + preview
if [ -f "$ENV_FILE" ]; then
  echo "==> pushing env from $ENV_FILE"
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue;; esac
    key="${line%%=*}"; value="${line#*=}"
    value="${value%\"}"; value="${value#\"}"
    [ -z "$key" ] && continue
    payload=$(python3 -c "import json,sys;print(json.dumps({'key':sys.argv[1],'value':sys.argv[2],'type':'encrypted','target':['production','preview']}))" "$key" "$value")
    curl -s -o /dev/null -X POST \
      "https://api.vercel.com/v10/projects/$NAME/env?teamId=$TEAM&upsert=true" \
      -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" -d "$payload"
    echo "   set $key"
  done < "$ENV_FILE"
fi

# link locally and deploy
mkdir -p .vercel
PID=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects/$NAME?teamId=$TEAM" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
printf '{"orgId":"%s","projectId":"%s"}\n' "$TEAM" "$PID" > .vercel/project.json
echo "==> deploying production"
npx --yes vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN"
