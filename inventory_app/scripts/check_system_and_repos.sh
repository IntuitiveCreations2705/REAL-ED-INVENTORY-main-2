#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_IMG="$ROOT/inventory_app/ui/static/system_map_latest.png"

echo "=== SYSTEM FILE CHECK ==="
if [[ -f "$TARGET_IMG" ]]; then
  echo "OK: Found system map file"
  ls -lh "$TARGET_IMG"
else
  echo "MISSING: $TARGET_IMG"
fi

echo
echo "=== APP REFERENCE CHECK ==="
if [[ -d "$ROOT/inventory_app/ui" ]]; then
  MATCHES=$(grep -R "system_map_latest\.png\|system_map" "$ROOT/inventory_app/ui" \
    --include="*.py" --include="*.html" --include="*.js" -n 2>/dev/null || true)
  if [[ -n "$MATCHES" ]]; then
    echo "OK: Found UI references:"
    echo "$MATCHES" | head -n 20
  else
    echo "WARN: No UI references found for system map in .py/.html/.js files"
  fi
else
  echo "MISSING: UI directory not found at $ROOT/inventory_app/ui"
fi

echo
echo "=== REPOSITORY CHECK (workspace scope) ==="
FOUND_REPO=0
while IFS= read -r gitdir; do
  FOUND_REPO=1
  REPO_DIR="${gitdir%/.git}"
  echo "Repo: $REPO_DIR"
  if git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    BRANCH=$(git -C "$REPO_DIR" branch --show-current 2>/dev/null || echo "(detached)")
    REMOTE=$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || echo "(no origin)")
    LAST_COMMIT=$(git -C "$REPO_DIR" log --oneline -1 2>/dev/null || echo "(no commits)")
    echo "  Branch: $BRANCH"
    echo "  Origin: $REMOTE"
    echo "  Last:   $LAST_COMMIT"
  else
    echo "  WARN: Not a valid git work tree"
  fi
  echo
done < <(find "$ROOT" -type d -name .git 2>/dev/null)

if [[ "$FOUND_REPO" -eq 0 ]]; then
  echo "No git repositories found inside workspace root: $ROOT"
fi

echo "=== SUMMARY ==="
echo "Workspace root: $ROOT"
echo "Checked: system map file + app references + git repos in workspace"
