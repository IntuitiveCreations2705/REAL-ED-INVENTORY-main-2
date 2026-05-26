#!/usr/bin/env bash
set -euo pipefail

# Source environment configuration; default to SSD if not set
ROOT="${INVENTORY_RUNTIME_ROOT:-/Volumes/2000 MASTER/REAL-ED-INVENTORY-main/REAL-ED-INVENTORY-main}"

# Validate runtime root is mounted and accessible
if [[ ! -d "$ROOT" ]]; then
    echo "[ERROR] INVENTORY_RUNTIME_ROOT not accessible: $ROOT" >&2
    echo "[ERROR] Failover: export INVENTORY_RUNTIME_ROOT=/Volumes/LANIA/... and retry" >&2
    exit 1
fi

LANIA_BACKUP_BASE="${INVENTORY_BACKUP_SECONDARY:-/Volumes/LANIA}"
LANIA_REPO="$LANIA_BACKUP_BASE/REAL-ED-INVENTORY-main"

DB_PATH="${INVENTORY_DB_PATH:-$ROOT/sql_inventory_master.db}"
SNAP_DIR="$ROOT/inventory_app/backups/db_snapshots"
META_DIR="$ROOT/inventory_app/backups"

mkdir -p "$SNAP_DIR" "$META_DIR"

if [[ ! -f "$DB_PATH" ]]; then
  echo "[ERROR] DB file not found: $DB_PATH" >&2
  exit 1
fi

if [[ ! -d "$LANIA_BACKUP_BASE" ]]; then
  echo "[ERROR] INVENTORY_BACKUP_SECONDARY not mounted: $LANIA_BACKUP_BASE" >&2
  exit 1
fi

if [[ ! -d "$LANIA_REPO" ]]; then
  echo "[ERROR] LANIA repo not found: $LANIA_REPO" >&2
  exit 1
fi

if ! git -C "$ROOT" rev-parse HEAD >/dev/null 2>&1; then
  echo "[ERROR] ROOT is not a git repo: $ROOT" >&2
  exit 1
fi

if ! git -C "$LANIA_REPO" rev-parse HEAD >/dev/null 2>&1; then
  echo "[ERROR] LANIA_REPO is not a git repo: $LANIA_REPO" >&2
  exit 1
fi

ts="$(date +%Y%m%d-%H%M%S)"
base="$(basename "$DB_PATH" .db)"
snap="$SNAP_DIR/${base}_${ts}.db"
latest="$SNAP_DIR/latest_${base}.db"

echo "[1/5] Snapshot DB: $DB_PATH"
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(FULL);" || true
sqlite3 "$DB_PATH" ".backup '$snap'"
cp -f "$snap" "$latest"

sha="$(shasum -a 256 "$snap" | awk '{print $1}')"
meta_file="$META_DIR/LAST_DB_SNAPSHOT.txt"
cat > "$meta_file" <<EOF
timestamp=$ts
source_db=$DB_PATH
snapshot=$snap
sha256=$sha
EOF

echo "[2/5] Commit + push origin/main (if changes exist)"
git -C "$ROOT" add -A
if ! git -C "$ROOT" diff --cached --quiet; then
  git -C "$ROOT" commit -m "checkpoint: $ts"
fi
git -C "$ROOT" push origin main

echo "[3/5] Sync snapshot artifacts to LANIA repo"
LANIA_SNAP_DIR="$LANIA_REPO/inventory_app/backups/db_snapshots"
LANIA_META_DIR="$LANIA_REPO/inventory_app/backups"
mkdir -p "$LANIA_SNAP_DIR" "$LANIA_META_DIR"
rsync -a "$snap" "$latest" "$LANIA_SNAP_DIR/"
rsync -a "$meta_file" "$LANIA_META_DIR/"

echo "[4/5] Fast-forward LANIA repo from origin/main"
git -C "$LANIA_REPO" fetch origin
git -C "$LANIA_REPO" checkout main
git -C "$LANIA_REPO" pull --ff-only origin main

echo "[5/5] Complete"
echo "Checkpoint timestamp: $ts"
echo "Snapshot file: $snap"
echo "Snapshot sha256: $sha"
