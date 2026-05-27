#!/bin/bash
# backup_main2_to_lania.sh — Git bundle backup for REAL-ED-INVENTORY-main-2
#
# Purpose: Daily backup of main-2 repository to LANIA DR drive
# Cadence: Can be scheduled via cron or called manually
# Retention: 30-day rolling window (older bundles auto-deleted)
#
# Usage:   ./backup_main2_to_lania.sh
#          ./backup_main2_to_lania.sh --force-full

set -euo pipefail

# Source environment configuration; default to 2000 MASTER GitHub hierarchy if not set
GITHUB_ROOT="${INVENTORY_GITHUB_ROOT:-/Volumes/2000 MASTER/MASTER INVENTORY FOLDER/GITHUB REPOSITORY}"
REPO_ROOT="${INVENTORY_RUNTIME_ROOT:-$GITHUB_ROOT/repo-main}"

# Validate runtime root is mounted and accessible
if [[ ! -d "$REPO_ROOT" ]]; then
    echo "[ERROR] INVENTORY_RUNTIME_ROOT not accessible: $REPO_ROOT" >&2
    echo "[ERROR] Failover: export INVENTORY_RUNTIME_ROOT=/Volumes/LANIA/... and retry" >&2
    exit 1
fi

MAIN2_DIR="${INVENTORY_MAIN2_DIR:-$GITHUB_ROOT/repo-main-2}"
LANIA_BACKUP_BASE="${INVENTORY_BACKUP_SECONDARY:-/Volumes/LANIA/REAL-ED-DR}"
LANIA_MAIN2="${INVENTORY_MAIN2_BACKUP_DIR:-$LANIA_BACKUP_BASE/main2_backups}"
LANIA_SNAPSHOTS="${INVENTORY_MAIN2_SNAPSHOTS_DIR:-$LANIA_BACKUP_BASE/main2_snapshots}"
FORCE_FULL=${1:-}

# Ensure backup secondary is accessible
if [[ ! -d "$LANIA_BACKUP_BASE" ]]; then
    echo "[ERROR] INVENTORY_BACKUP_SECONDARY not mounted: $LANIA_BACKUP_BASE" >&2
    exit 1
fi

# Ensure main-2 repo exists (allow both .git dir and git worktree)
if [[ ! -d "$MAIN2_DIR" ]]; then
    echo "[ERROR] REAL-ED-INVENTORY-main-2 directory not found: $MAIN2_DIR" >&2
    exit 1
fi

cd "$MAIN2_DIR"
if ! git rev-parse HEAD >/dev/null 2>&1; then
    echo "[ERROR] REAL-ED-INVENTORY-main-2 is not a valid Git repository: $MAIN2_DIR" >&2
    exit 1
fi

# Helper functions
log() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S UTC')
    echo "[$timestamp] $msg"
}

backup_to_lania() {
    mkdir -p "$LANIA_MAIN2" "$LANIA_SNAPSHOTS"
    
    # Already in $MAIN2_DIR from earlier cd
    local commit_sha=$(git rev-parse HEAD)
    local timestamp=$(date -u +%Y%m%dT%H%M%SZ)
    local bundle_name="main2_${timestamp}_${commit_sha:0:8}.bundle"
    local bundle_path="$LANIA_MAIN2/$bundle_name"
    local snapshot_name="snapshot_${timestamp}"
    local snapshot_path="$LANIA_SNAPSHOTS/$snapshot_name"
    
    log "═══════════════════════════════════════════════════════════════"
    log "MAIN-2 REPOSITORY BACKUP TO LANIA"
    log "═══════════════════════════════════════════════════════════════"
    log "Repository: $MAIN2_DIR"
    log "Commit: $commit_sha"
    log "Timestamp: $timestamp"
    log ""
    
    # Create git bundle (full repository backup)
    log "Creating git bundle: $bundle_name"
    git bundle create "$bundle_path" --all
    
    # Verify bundle integrity
    log "Verifying bundle integrity..."
    if git bundle verify "$bundle_path" >/dev/null 2>&1; then
        log "✓ Bundle integrity verified"
        local bundle_size=$(stat -f%z "$bundle_path" 2>/dev/null || stat -c%s "$bundle_path")
        log "  Bundle size: $bundle_size bytes"
    else
        log "[ERROR] Bundle integrity check failed" >&2
        rm -f "$bundle_path"
        exit 1
    fi
    
    # Create SHA256 checksum
    log "Generating SHA256 checksum..."
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$bundle_path" > "${bundle_path}.sha256"
    else
        sha256sum "$bundle_path" > "${bundle_path}.sha256"
    fi
    log "✓ Checksum stored: ${bundle_name}.sha256"
    
    # Create snapshot (git archive for easy inspection)
    log "Creating git snapshot archive..."
    mkdir -p "$snapshot_path"
    cd "$MAIN2_DIR"
    git archive HEAD --format=tar.gz --output="$snapshot_path/main2_${timestamp}.tar.gz"
    git rev-parse HEAD > "$snapshot_path/HEAD.txt"
    git log --oneline -10 > "$snapshot_path/COMMITS.txt"
    log "✓ Snapshot created: $(basename "$snapshot_path")"
    
    # Update manifest
    local manifest="$LANIA_MAIN2/manifest.csv"
    if [[ ! -f "$manifest" ]]; then
        echo "timestamp_utc,commit_sha,bundle_file,checksum_file,snapshot_path" > "$manifest"
    fi
    echo "$timestamp,$commit_sha,$bundle_name,${bundle_name}.sha256,$snapshot_path" >> "$manifest"
    log "✓ Manifest updated"
    
    # Rotate old backups (keep 30 days)
    log ""
    log "Rotating old backups (retention: 30 days)..."
    find "$LANIA_MAIN2" -maxdepth 1 -type f -name 'main2_*.bundle' -mtime +30 -print -delete || true
    find "$LANIA_MAIN2" -maxdepth 1 -type f -name 'main2_*.bundle.sha256' -mtime +30 -print -delete || true
    find "$LANIA_SNAPSHOTS" -maxdepth 1 -type d -name 'snapshot_*' -mtime +30 -exec rm -rf {} \; || true
    log "✓ Old backups rotated"
    
    log ""
    log "═══════════════════════════════════════════════════════════════"
    log "BACKUP COMPLETE"
    log "═══════════════════════════════════════════════════════════════"
    log "Bundle: $LANIA_MAIN2/$bundle_name"
    log "Snapshot: $snapshot_path"
    log ""
}

# Execute backup
backup_to_lania

exit 0
