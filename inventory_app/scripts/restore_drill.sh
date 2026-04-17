#!/usr/bin/env bash
# restore_drill.sh
# Weekly restore drill against latest backup.
# Usage: restore_drill.sh /path/to/backup_dir /path/to/output_log

set -euo pipefail
BACKUP_DIR=${1:-}
OUT_LOG=${2:-}
if [ -z "$BACKUP_DIR" ] || [ -z "$OUT_LOG" ]; then
  echo "Usage: $0 /path/to/backup_dir /path/to/output_log" >&2
  exit 2
fi

mkdir -p "$(dirname "$OUT_LOG")"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "[$TS] restore drill started"
  "$(dirname "$0")/verify_backup.sh" "$BACKUP_DIR"
  echo "[$TS] restore drill successful"
} >> "$OUT_LOG" 2>&1
