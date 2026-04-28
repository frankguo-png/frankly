#!/usr/bin/env bash
# Railway cron entry point. Hits each sync endpoint with the CRON_SECRET so
# they take the cron-job branch of the route handler. Railway provides the
# service URL via $RAILWAY_PUBLIC_DOMAIN; CRON_SECRET must be set in the
# Railway service variables.
#
# Usage in a Railway cron service:
#   bash scripts/railway-cron-sync.sh
#
# Schedules:
#   Plaid + QBO + Rippling — recommended every 6 hours: "0 */6 * * *"
set -euo pipefail

if [[ -z "${RAILWAY_PUBLIC_DOMAIN:-}" ]]; then
  echo "RAILWAY_PUBLIC_DOMAIN is not set; cron service must be in the same project as the app." >&2
  exit 1
fi
if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is not set; cron paths will return 401." >&2
  exit 1
fi

BASE_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
AUTH="Authorization: Bearer ${CRON_SECRET}"

run() {
  local label="$1" path="$2"
  echo "[$(date -u +%FT%TZ)] $label  POST $BASE_URL$path"
  http_status=$(
    curl -s -o /tmp/cron-${label}.body -w "%{http_code}" -X POST \
      "$BASE_URL$path" -H "$AUTH" -H "Content-Type: application/json" -d '{}'
  )
  echo "[$(date -u +%FT%TZ)] $label  HTTP $http_status  $(cat /tmp/cron-${label}.body)"
}

run plaid    /api/plaid/sync
run qbo      /api/qbo/sync
run rippling /api/rippling/sync
