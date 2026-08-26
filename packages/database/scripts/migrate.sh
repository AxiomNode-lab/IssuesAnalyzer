#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$(dirname "$0")/../migrations/0001_initial.sql"
