#!/usr/bin/env bash
# auto_backup.sh
# Creates a consistent SQL dump of sqlite DB, compresses it, writes checksum,
# copies to primary/secondary backup stores, optional offsite dir, and rotates old files.
# Usage:
#   auto_backup.sh <db_path> <backup_primary> [backup_secondary] [retention_days] [offsite_dir]

set -euo pipefail
DB_PATH=${1:-}
BACKUP1=${2:-}
BACKUP2=${3:-}
RETENTION_DAYS=${4:-30}
BACKUP_OFFSITE=${5:-}

file_size_bytes() {
  if stat -f%z "$1" >/dev/null 2>&1; then
    stat -f%z "$1"
  else
    stat -c%s "$1"
  fi
}

if [ -z "$DB_PATH" ] || [ -z "$BACKUP1" ]; then
  echo "Usage: $0 /path/to/sql_inventory_master.db /path/to/backup_mount1 [/path/to/backup_mount2] [retention_days] [offsite_dir]" >&2
  exit 2
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
FNAME="sql_inventory_master_${TIMESTAMP}.sql.gz"
SUM_NAME="${FNAME}.sha256"
TMPDIR=$(mktemp -d)
DUMP_PATH="$TMPDIR/$FNAME"
SUM_PATH="$TMPDIR/$SUM_NAME"

# Use sqlite3 dump (text) then gzip - small, portable, text-friendly
echo "Creating SQL dump -> $DUMP_PATH"
sqlite3 "$DB_PATH" .dump | gzip -9 > "$DUMP_PATH"
gzip -t "$DUMP_PATH"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$DUMP_PATH" > "$SUM_PATH"
else
  sha256sum "$DUMP_PATH" > "$SUM_PATH"
fi

# Ensure backup dirs exist
mkdir -p "$BACKUP1"
cp "$DUMP_PATH" "$BACKUP1/"
cp "$SUM_PATH" "$BACKUP1/"

if [ -n "$BACKUP2" ]; then
  mkdir -p "$BACKUP2"
  cp "$DUMP_PATH" "$BACKUP2/"
  cp "$SUM_PATH" "$BACKUP2/"
fi

if [ -n "$BACKUP_OFFSITE" ]; then
  mkdir -p "$BACKUP_OFFSITE"
  cp "$DUMP_PATH" "$BACKUP_OFFSITE/"
  cp "$SUM_PATH" "$BACKUP_OFFSITE/"
fi

# Record metadata
echo "$TIMESTAMP,$FNAME,$(file_size_bytes "$DUMP_PATH"),$SUM_NAME" >> "$BACKUP1/backup_manifest.csv" || true
if [ -n "$BACKUP2" ]; then
  echo "$TIMESTAMP,$FNAME,$(file_size_bytes "$DUMP_PATH"),$SUM_NAME" >> "$BACKUP2/backup_manifest.csv" || true
fi
if [ -n "$BACKUP_OFFSITE" ]; then
  echo "$TIMESTAMP,$FNAME,$(file_size_bytes "$DUMP_PATH"),$SUM_NAME" >> "$BACKUP_OFFSITE/backup_manifest.csv" || true
fi

# Rotate old backups
find "$BACKUP1" -maxdepth 1 -type f -name 'sql_inventory_master_*.sql.gz' -mtime +$RETENTION_DAYS -print -delete || true
find "$BACKUP1" -maxdepth 1 -type f -name 'sql_inventory_master_*.sql.gz.sha256' -mtime +$RETENTION_DAYS -print -delete || true
if [ -n "$BACKUP2" ]; then
  find "$BACKUP2" -maxdepth 1 -type f -name 'sql_inventory_master_*.sql.gz' -mtime +$RETENTION_DAYS -print -delete || true
  find "$BACKUP2" -maxdepth 1 -type f -name 'sql_inventory_master_*.sql.gz.sha256' -mtime +$RETENTION_DAYS -print -delete || true
fi
if [ -n "$BACKUP_OFFSITE" ]; then
  find "$BACKUP_OFFSITE" -maxdepth 1 -type f -name 'sql_inventory_master_*.sql.gz' -mtime +$RETENTION_DAYS -print -delete || true
  find "$BACKUP_OFFSITE" -maxdepth 1 -type f -name 'sql_inventory_master_*.sql.gz.sha256' -mtime +$RETENTION_DAYS -print -delete || true
fi

# Cleanup
rm -rf "$TMPDIR"

echo "Backup complete: $FNAME -> $BACKUP1 ${BACKUP2:+, $BACKUP2}${BACKUP_OFFSITE:+, $BACKUP_OFFSITE}"
