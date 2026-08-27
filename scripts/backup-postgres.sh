#!/bin/sh
set -eu

DATABASE_URL=${DATABASE_URL:-}
BACKUP_PATH=${BACKUP_PATH:-}

if [ -z "$DATABASE_URL" ] || [ -z "$BACKUP_PATH" ]; then
  echo "DATABASE_URL and BACKUP_PATH are required" >&2
  exit 2
fi

umask 077
pg_dump --format=custom --no-owner --no-acl --file="$BACKUP_PATH" "$DATABASE_URL"
pg_restore --list "$BACKUP_PATH" >/dev/null

echo "Backup created and verified: $BACKUP_PATH"
