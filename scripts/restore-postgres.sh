#!/bin/sh
set -eu

TARGET_DATABASE_URL=${TARGET_DATABASE_URL:-}
BACKUP_PATH=${BACKUP_PATH:-}
CONFIRM_DESTRUCTIVE_RESTORE=${CONFIRM_DESTRUCTIVE_RESTORE:-}

if [ -z "$TARGET_DATABASE_URL" ] || [ -z "$BACKUP_PATH" ]; then
  echo "TARGET_DATABASE_URL and BACKUP_PATH are required" >&2
  exit 2
fi

if [ "$CONFIRM_DESTRUCTIVE_RESTORE" != "I_UNDERSTAND_THIS_CLEANS_THE_TARGET" ]; then
  echo "Set CONFIRM_DESTRUCTIVE_RESTORE=I_UNDERSTAND_THIS_CLEANS_THE_TARGET to continue" >&2
  exit 2
fi

if [ ! -f "$BACKUP_PATH" ]; then
  echo "Backup file does not exist: $BACKUP_PATH" >&2
  exit 2
fi

pg_restore --list "$BACKUP_PATH" >/dev/null
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" "$BACKUP_PATH"

echo "Restore completed: $BACKUP_PATH"
