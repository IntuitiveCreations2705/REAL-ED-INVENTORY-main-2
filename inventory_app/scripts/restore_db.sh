#!/usr/bin/env bash
# restore_db.sh - restore sqlite DB from a SQL dump or a DB copy
# Usage:
#   ./inventory_app/scripts/restore_db.sh /path/to/dump.sql
#   ./inventory_app/scripts/restore_db.sh --copy /path/to/sql_inventory_master_YYYYMMDDT....db

set -euo pipefail
if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <dump.sql> | --copy <db-file>" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$ROOT_DIR/../sql_inventory_master.db"

case "$1" in
  --copy)
    if [ -z "${2-}" ]; then
      echo "Missing DB file argument for --copy" >&2
      exit 2
    fi
    SRC="$2"
    echo "Restoring DB by copying $SRC -> $DB_PATH"
    cp "$SRC" "$DB_PATH"
    echo "Done."
    ;;
  *)
    SRC="$1"
    if [ ! -f "$SRC" ]; then
      echo "Dump file not found: $SRC" >&2
      exit 2
    fi
    echo "Restoring DB from SQL dump $SRC -> $DB_PATH"
    sqlite3 "$DB_PATH" < "$SRC"
    echo "Done."
    ;;
esac
