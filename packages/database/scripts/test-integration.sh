#!/usr/bin/env sh
set -eu

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL must be set}"

psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../migrations/0001_initial.sql"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../tests/0001_initial.integration.sql"
