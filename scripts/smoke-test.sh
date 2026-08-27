#!/bin/sh
set -eu

BASE_URL=${1:-${BASE_URL:-}}
if [ -z "$BASE_URL" ]; then
  echo "Usage: scripts/smoke-test.sh https://service.example" >&2
  exit 2
fi

curl --fail --silent --show-error "$BASE_URL/api/health/live" >/dev/null
curl --fail --silent --show-error "$BASE_URL/api/health/ready" >/dev/null

echo "Smoke test passed for $BASE_URL"
