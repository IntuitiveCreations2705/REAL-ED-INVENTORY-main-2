#!/usr/bin/env bash
# verify_backup.sh
# Verifies latest backup by integrity check + trial restore into temp sqlite DB.
# Usage: verify_backup.sh /absolute/path/to/backup_dir

set -euo pipefail
BACKUP_DIR=${1:-}
if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: $0 /path/to/backup_dir" >&2
  exit 2
fi

LATEST=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'sql_inventory_master_*.sql.gz' | sort | tail -n 1)
if [ -z "$LATEST" ]; then
  echo "No backup files found in $BACKUP_DIR" >&2
  exit 1
fi

echo "Verifying $LATEST"
gzip -t "$LATEST"

TMPDIR=$(mktemp -d)
TMPDB="$TMPDIR/verify.sqlite"

gunzip -c "$LATEST" | sqlite3 "$TMPDB"

# Basic sanity checks
TABLE_COUNT=$(sqlite3 "$TMPDB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
if [ "${TABLE_COUNT:-0}" -lt 1 ]; then
  echo "Verification failed: restored DB has no tables" >&2
  rm -rf "$TMPDIR"
  exit 1
fi

echo "Verification OK: tables=$TABLE_COUNT file=$LATEST"
rm -rf "$TMPDIR"
