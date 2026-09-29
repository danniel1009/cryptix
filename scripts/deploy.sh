#!/usr/bin/env bash
# Cryptix — deploy to a DewaWeb/DewaVPS Ubuntu host over SSH (near-zero downtime).
#
#   1. rsync the source (NO --delete: server-only files such as .env.production survive)
#   2. npm ci on the server only when package-lock.json changed
#   3. build into .next.new AS THE SERVICE USER while the old build keeps serving
#   4. only if the build succeeded: swap .next.new -> .next (0.04s) and restart the service
#   5. health-check /api/market and roll back automatically if it fails
#
# Configuration: deploy/.deployrc (gitignored) or environment variables:
#   DEPLOY_HOST=203.0.113.10  DEPLOY_USER=root  DEPLOY_KEY=~/.ssh/cryptix_vps
#   DEPLOY_PATH=/opt/cryptix  DEPLOY_SERVICE=cryptix-web  DEPLOY_APP_USER=cryptix  DEPLOY_PORT=3000
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/deploy/.deployrc" ]] && source "$ROOT/deploy/.deployrc"

: "${DEPLOY_HOST:?set DEPLOY_HOST (server IP or hostname)}"
: "${DEPLOY_USER:=root}"
: "${DEPLOY_KEY:=$HOME/.ssh/cryptix_vps}"
: "${DEPLOY_PATH:=/opt/cryptix}"
: "${DEPLOY_SERVICE:=cryptix-web}"
: "${DEPLOY_APP_USER:=cryptix}"
: "${DEPLOY_PORT:=3000}"
: "${DEPLOY_SSH_PORT:=22}"

SSH=(ssh -i "$DEPLOY_KEY" -p "$DEPLOY_SSH_PORT" -o StrictHostKeyChecking=accept-new "$DEPLOY_USER@$DEPLOY_HOST")
STAMP="$(date +%Y%m%d-%H%M%S)"

log() { printf '\033[1;32m[deploy]\033[0m %s\n' "$*"; }

log "pre-flight: typecheck + lint + tests (local)"
(cd "$ROOT" && npm run typecheck && npm run lint && npm run test) || { echo "local checks failed — not deploying"; exit 1; }

log "connection test → $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_SSH_PORT"
"${SSH[@]}" "test -d '$DEPLOY_PATH' || { echo 'missing $DEPLOY_PATH — run deploy/server-setup.sh first'; exit 1; }"

LOCK_BEFORE="$("${SSH[@]}" "sha256sum '$DEPLOY_PATH/package-lock.json' 2>/dev/null | cut -c1-16 || true")"

log "rsync source (no --delete, ownership not preserved)"
rsync -az --no-owner --no-group -e "ssh -i $DEPLOY_KEY -p $DEPLOY_SSH_PORT" \
  --exclude '.git' --exclude 'node_modules' --exclude '.next' --exclude '.next.new' --exclude '.next-build' \
  --exclude '.next.rollback-*' --exclude '.env*' --exclude 'deploy/.deployrc' --exclude '.claude' \
  --exclude 'coverage' --exclude '*.log' \
  "$ROOT/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

# next build writes tsconfig.json; files synced as root would make the build EACCES as the app user
"${SSH[@]}" "chown -R '$DEPLOY_APP_USER':'$DEPLOY_APP_USER' '$DEPLOY_PATH'"

LOCK_AFTER="$("${SSH[@]}" "sha256sum '$DEPLOY_PATH/package-lock.json' | cut -c1-16")"
if [[ "$LOCK_BEFORE" != "$LOCK_AFTER" ]]; then
  log "package-lock changed → npm ci (as $DEPLOY_APP_USER)"
  "${SSH[@]}" "cd '$DEPLOY_PATH' && sudo -u '$DEPLOY_APP_USER' env HOME='$DEPLOY_PATH' npm ci --no-audit --no-fund"
else
  log "package-lock unchanged → skipping npm ci"
fi

log "build into .next.new while the current build keeps serving"
set +e
"${SSH[@]}" "cd '$DEPLOY_PATH' && rm -rf .next.new && sudo -u '$DEPLOY_APP_USER' env HOME='$DEPLOY_PATH' NEXT_DIST_DIR=.next.new NODE_ENV=production npm run build"
BUILD_EXIT=$?
set -e
if [[ $BUILD_EXIT -ne 0 ]]; then
  echo "build failed (exit $BUILD_EXIT) — the running site was never touched"; exit 1
fi

log "swap builds + restart $DEPLOY_SERVICE"
"${SSH[@]}" "cd '$DEPLOY_PATH' \
  && systemctl stop '$DEPLOY_SERVICE' \
  && { [ -d .next ] && mv .next '.next.rollback-$STAMP' || true; } \
  && mv .next.new .next \
  && chown -R '$DEPLOY_APP_USER':'$DEPLOY_APP_USER' .next \
  && systemctl start '$DEPLOY_SERVICE'"

log "health check"
for i in $(seq 1 20); do
  if "${SSH[@]}" "curl -fsS -m 5 http://127.0.0.1:$DEPLOY_PORT/api/market >/dev/null"; then
    log "OK — /api/market answers on port $DEPLOY_PORT"
    "${SSH[@]}" "cd '$DEPLOY_PATH' && ls -d .next.rollback-* 2>/dev/null | sort | head -n -2 | xargs -r rm -rf"
    log "done ($STAMP)"; exit 0
  fi
  sleep 1
done

echo "health check FAILED — rolling back to the previous build"
"${SSH[@]}" "cd '$DEPLOY_PATH' && systemctl stop '$DEPLOY_SERVICE' && rm -rf .next.failed-$STAMP && mv .next .next.failed-$STAMP && mv '.next.rollback-$STAMP' .next && systemctl start '$DEPLOY_SERVICE'"
exit 1
